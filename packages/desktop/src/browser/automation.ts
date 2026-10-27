import { captureNativePage } from './capture.ts';
import type { WebContents } from 'electron';

/** Keep hidden guest rendering behind the app while automation needs frames; never show/focus a window. */
export const guestAutomation = (contents: WebContents, paint: (active: boolean) => void) => {
  let active = 0;
  let streaming = false;
  let focused = false;
  let focusChange = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const focus = (enabled: boolean) => {
    if (focused === enabled) return focusChange;
    focused = enabled;
    focusChange = focusChange.then(async () => {
      if (!contents.isDestroyed())
        await contents.debugger
          .sendCommand('Emulation.setFocusEmulationEnabled', { enabled })
          .catch(() => {});
    });
    return focusChange;
  };
  const release = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (active || streaming || contents.isDestroyed()) return;
      paint(false);
      void focus(false);
    }, 300);
  };
  contents.once('destroyed', () => clearTimeout(timer));
  return {
    get active() {
      return active > 0;
    },
    send: async (method: string, params: Record<string, unknown>, child?: string) => {
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
      if (method === 'Page.startScreencast') streaming = true;
      if (method === 'Page.stopScreencast') streaming = false;
      active++;
      clearTimeout(timer);
      paint(true);
      try {
        await focus(true);
        if (method === 'Page.captureScreenshot') {
          if (child) throw new Error('Native capture is limited to the owned page.');
          return await captureNativePage(contents, params);
        }
        return await contents.debugger.sendCommand(method, params, child);
      } finally {
        active--;
        release();
      }
    },
  };
};
