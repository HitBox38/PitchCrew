import { captureNativePage } from './capture.ts';
import { sendGuestCommand } from './input.ts';
import type { WebContents } from 'electron';

/** Keep hidden guest rendering behind the app while automation needs frames; never show/focus a window. */
export const guestAutomation = (
  contents: WebContents,
  paint: (active: boolean) => void,
  displayScale = () => 1,
) => {
  const pending = new Map<object, { owner?: string; paints: boolean }>();
  const streams = new Map<string | undefined, Set<string | undefined>>();
  const inputGrace = new Map<string | undefined, number>();
  let focused = false;
  let focusChange = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const syncPainting = () =>
    paint(streams.size > 0 || [...pending.values()].some((hold) => hold.paints));
  const streaming = (child?: string) => [...streams.values()].some((owned) => owned.has(child));
  const focus = (enabled: boolean) => {
    if (focused === enabled) return focusChange;
    focused = enabled;
    // A page modal may leave an earlier focus command unanswered. Releasing its
    // owner must still be able to send the new state without waiting on it.
    focusChange = contents.isDestroyed()
      ? Promise.resolve()
      : contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled }).then(
          () => {},
          () => {},
        );
    return focusChange;
  };
  const scheduleRelease = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const [owner, until] of inputGrace) if (until <= Date.now()) inputGrace.delete(owner);
      if (pending.size || streams.size || contents.isDestroyed()) return;
      syncPainting();
      void focus(false);
    }, 300);
  };
  const release = (owner?: string) => {
    const previousStreams = new Set(
      owner === undefined
        ? [...streams.values()].flatMap((owned) => [...owned])
        : streams.get(owner),
    );
    for (const [token, hold] of pending)
      if (owner === undefined || hold.owner === owner) pending.delete(token);
    if (owner === undefined) streams.clear();
    else streams.delete(owner);
    if (owner === undefined) inputGrace.clear();
    else inputGrace.delete(owner);
    for (const child of previousStreams)
      if (!streaming(child) && !contents.isDestroyed())
        void contents.debugger.sendCommand('Page.stopScreencast', {}, child).catch(() => {});
    syncPainting();
    scheduleRelease();
  };
  contents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
    if (!mainFrame || inPlace) return;
    // Commands for the old document cannot keep an invisible guest awake forever.
    // A live viewer's screencast still owns its paint lease across navigation.
    pending.clear();
    inputGrace.clear();
    syncPainting();
    scheduleRelease();
  });
  contents.on('render-process-gone', () => release());
  contents.once('destroyed', () => {
    pending.clear();
    streams.clear();
    inputGrace.clear();
    clearTimeout(timer);
    paint(false);
  });
  return {
    get active() {
      return pending.size > 0 || [...inputGrace.values()].some((until) => until > Date.now());
    },
    release,
    send: async (
      method: string,
      params: Record<string, unknown>,
      child?: string,
      owner?: string,
    ) => {
      if (
        method.startsWith('Browser.') ||
        (method.startsWith('Target.') &&
          !['Target.setAutoAttach', 'Target.detachFromTarget'].includes(method))
      )
        throw new Error('This operation cannot access other browser targets.');
      // A JavaScript modal can block focus-emulation commands; resolve it directly.
      if (method === 'Page.handleJavaScriptDialog')
        return contents.debugger.sendCommand(method, params, child);
      if (method === 'Target.setAutoAttach') params = { ...params, waitForDebuggerOnStart: false };
      const streamKey = child;
      if (method === 'Page.startScreencast') {
        const existing = streaming(streamKey);
        const owned = streams.get(owner) ?? new Set<string | undefined>();
        owned.add(streamKey);
        streams.set(owner, owned);
        if (existing) return {};
      }
      const stopStreaming = () => {
        const owned = streams.get(owner);
        owned?.delete(streamKey);
        if (!owned?.size) streams.delete(owner);
      };
      if (method === 'Page.stopScreencast') {
        stopStreaming();
        if (streaming(streamKey)) return {};
      }
      const token = {};
      // Electron's input dispatch also needs a composited surface for hidden guests.
      // Keep the owned page paintable for the command, without showing its window.
      pending.set(token, { owner, paints: true });
      clearTimeout(timer);
      syncPainting();
      try {
        await focus(true);
        if (!pending.has(token) || contents.isDestroyed())
          throw new Error('The browser operation owner closed or the page changed.');
        if (method === 'Page.captureScreenshot') {
          if (child) throw new Error('Native capture is limited to the owned page.');
          return await captureNativePage(
            contents,
            params,
            displayScale(),
            () => pending.has(token) && !contents.isDestroyed(),
          );
        }
        return await (child
          ? contents.debugger.sendCommand(method, params, child)
          : sendGuestCommand(contents, method, params));
      } catch (error) {
        if (method === 'Page.startScreencast') stopStreaming();
        throw error;
      } finally {
        const owned = pending.delete(token);
        if (owned && method.startsWith('Input.')) inputGrace.set(owner, Date.now() + 300);
        // Chromium can acknowledge input before its event reaches the page. Keep
        // the existing short paint grace; explicit owner release still drops it.
        scheduleRelease();
      }
    },
  };
};
