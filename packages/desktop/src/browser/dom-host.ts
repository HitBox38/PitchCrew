import { randomUUID } from 'node:crypto';
import { ipcMain, session, type BrowserWindow, type WebContents } from 'electron';
import { z } from 'zod';
import type { DesktopBrowserView } from '../../../core/src/native-browser.ts';
import { domBrowserBootstrapUrl, domBrowserChannels } from './dom-protocol.ts';

const partitionPattern = /^persist:pitchcrew-browser-[a-f0-9]{64}$/;

interface GuestRequest {
  view: DesktopBrowserView;
  accepted: boolean;
  registered: boolean;
  guest?: WebContents;
  resolve(contents: WebContents): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

interface CapturedGuest {
  contents: WebContents;
  request?: GuestRequest;
  firstNavigation?: string;
  timer: ReturnType<typeof setTimeout>;
  destroyed(): void;
  navigating(event: Electron.Event, url: string, inPlace: boolean, mainFrame: boolean): void;
  nested(event: Electron.Event): void;
}

/** Main owns every guest; preload supplies only its permanent DOM presentation. */
export const createDomBrowserHost = (
  getWindow: () => BrowserWindow | null,
  getOrigin: () => string,
  onReset = () => {},
) => {
  const requests = new Map<string, GuestRequest>();
  const guests = new Map<number, CapturedGuest>();
  let installed: BrowserWindow | null = null;
  let uninstall = () => {};
  let closed = false;
  const trusted = (window: BrowserWindow | null) => {
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return false;
    try {
      return new URL(window.webContents.mainFrame.url).origin === getOrigin();
    } catch {
      return false;
    }
  };
  const views = () => [...requests.values()].map(({ view }) => structuredClone(view));
  const publish = () => {
    if (installed && getWindow() === installed && trusted(installed))
      installed.webContents.mainFrame.send(domBrowserChannels.changed, views());
  };
  const forgetGuest = (guest: CapturedGuest) => {
    guests.delete(guest.contents.id);
    clearTimeout(guest.timer);
    guest.contents.removeListener('destroyed', guest.destroyed);
    guest.contents.removeListener('did-start-navigation', guest.navigating);
    guest.contents.removeListener('will-attach-webview', guest.nested);
  };
  const remove = (request: GuestRequest, error: Error, closeGuest: boolean) => {
    if (requests.get(request.view.token) !== request) return;
    requests.delete(request.view.token);
    clearTimeout(request.timer);
    const guest = request.guest && guests.get(request.guest.id);
    if (guest) forgetGuest(guest);
    if (!request.registered) request.reject(error);
    if (closeGuest && request.guest && !request.guest.isDestroyed()) request.guest.close();
    publish();
  };
  const reset = () => {
    onReset();
    for (const request of [...requests.values()])
      remove(request, new Error('The desktop browser host reloaded.'), true);
    for (const guest of [...guests.values()]) {
      forgetGuest(guest);
      if (!guest.contents.isDestroyed()) guest.contents.close();
    }
  };
  const authorize = (event: Electron.IpcMainInvokeEvent) => {
    const window = getWindow();
    if (
      closed ||
      window !== installed ||
      !trusted(window) ||
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error('Desktop browser access is unavailable.');
  };
  ipcMain.handle(domBrowserChannels.views, (event) => {
    authorize(event);
    return views();
  });
  ipcMain.handle(domBrowserChannels.register, (event, rawToken: unknown, rawId: unknown) => {
    authorize(event);
    const token = z.uuid().parse(rawToken);
    const id = z.number().int().positive().parse(rawId);
    const request = requests.get(token);
    const captured = guests.get(id);
    const guest = captured?.contents;
    if (
      !request ||
      !request.accepted ||
      !captured ||
      !guest ||
      guest.id !== id ||
      guest.isDestroyed() ||
      guest.getType() !== 'webview' ||
      guest.hostWebContents !== installed?.webContents ||
      guest.session !== session.fromPartition(request.view.partition)
    )
      throw new Error('The browser guest is not owned by this request.');
    if (request.registered && request.guest === guest) return;
    if (
      guest.getURL() !== domBrowserBootstrapUrl(token) ||
      (request.guest && request.guest !== guest) ||
      (captured.request && captured.request !== request) ||
      (captured.firstNavigation && captured.firstNavigation !== domBrowserBootstrapUrl(token))
    )
      throw new Error('The browser guest is not owned by this request.');
    request.guest = guest;
    captured.request = request;
    clearTimeout(request.timer);
    clearTimeout(captured.timer);
    request.registered = true;
    request.view.contentsId = guest.id;
    request.resolve(guest);
    publish();
  });
  return {
    install: (window: BrowserWindow) => {
      if (closed) throw new Error('The desktop browser host is closed.');
      if (installed === window) return;
      reset();
      uninstall();
      installed = window;
      const contents = window.webContents;
      const attach = (
        event: Electron.Event,
        preferences: Electron.WebPreferences,
        params: Record<string, string>,
      ) => {
        const request = [...requests.values()].find(
          (item) => domBrowserBootstrapUrl(item.view.token) === params.src,
        );
        if (
          getWindow() !== window ||
          !trusted(window) ||
          !request ||
          request.accepted ||
          request.view.partition !== params.partition
        ) {
          event.preventDefault();
          return;
        }
        request.accepted = true;
        delete preferences.preload;
        preferences.session = session.fromPartition(request.view.partition);
        preferences.partition = request.view.partition;
        preferences.sandbox = true;
        preferences.contextIsolation = true;
        preferences.webSecurity = true;
        preferences.nodeIntegration = false;
        preferences.nodeIntegrationInWorker = false;
        preferences.nodeIntegrationInSubFrames = false;
        preferences.webviewTag = false;
        preferences.allowRunningInsecureContent = false;
        preferences.backgroundThrottling = false;
        preferences.autoplayPolicy = 'user-gesture-required';
        delete preferences.additionalArguments;
      };
      const attached = (_event: Electron.Event, guest: WebContents) => {
        if (
          getWindow() !== window ||
          !trusted(window) ||
          guest.getType() !== 'webview' ||
          guest.hostWebContents !== contents ||
          ![...requests.values()].some(
            (request) =>
              request.accepted &&
              !request.guest &&
              guest.session === session.fromPartition(request.view.partition),
          )
        ) {
          if (!guest.isDestroyed()) guest.close();
          return;
        }
        const captured: CapturedGuest = {
          contents: guest,
          timer: setTimeout(() => {
            if (captured.request)
              remove(
                captured.request,
                new Error('The browser guest did not register in time.'),
                true,
              );
            else {
              forgetGuest(captured);
              if (!guest.isDestroyed()) guest.close();
            }
          }, 10000),
          destroyed: () => {
            if (captured.request)
              remove(captured.request, new Error('The browser guest closed.'), false);
            else forgetGuest(captured);
          },
          navigating: (_event, url, _inPlace, mainFrame) => {
            if (!mainFrame || captured.request?.registered) return;
            captured.firstNavigation ??= url;
            const request = [...requests.values()].find(
              (item) => domBrowserBootstrapUrl(item.view.token) === url,
            );
            if (
              !request ||
              !request.accepted ||
              (request.guest && request.guest !== guest) ||
              (captured.request && captured.request !== request) ||
              guest.session !== session.fromPartition(request.view.partition)
            ) {
              if (captured.request)
                remove(captured.request, new Error('The browser bootstrap changed.'), true);
              else {
                forgetGuest(captured);
                if (!guest.isDestroyed()) guest.close();
              }
              return;
            }
            captured.request = request;
            request.guest = guest;
          },
          nested: (event) => event.preventDefault(),
        };
        guests.set(guest.id, captured);
        guest.once('destroyed', captured.destroyed);
        guest.on('did-start-navigation', captured.navigating);
        guest.on('will-attach-webview', captured.nested);
      };
      const navigating = (
        _event: Electron.Event,
        _url: string,
        inPlace: boolean,
        mainFrame: boolean,
      ) => {
        if (mainFrame && !inPlace) reset();
      };
      contents.on('will-attach-webview', attach);
      contents.on('did-attach-webview', attached);
      contents.on('did-start-navigation', navigating);
      contents.on('render-process-gone', reset);
      contents.on('destroyed', reset);
      window.on('closed', reset);
      uninstall = () => {
        contents.removeListener('will-attach-webview', attach);
        contents.removeListener('did-attach-webview', attached);
        contents.removeListener('did-start-navigation', navigating);
        contents.removeListener('render-process-gone', reset);
        contents.removeListener('destroyed', reset);
        window.removeListener('closed', reset);
        installed = null;
      };
    },
    create: (partition: string): Promise<WebContents> => {
      if (
        closed ||
        !installed ||
        getWindow() !== installed ||
        !trusted(installed) ||
        !partitionPattern.test(partition) ||
        requests.size >= 1024
      )
        return Promise.reject(new Error('The desktop browser is unavailable.'));
      return new Promise<WebContents>((resolve, reject) => {
        const token = randomUUID();
        const request: GuestRequest = {
          view: { token, partition, bounds: null, painting: false, manual: false },
          accepted: false,
          registered: false,
          resolve,
          reject,
          timer: setTimeout(() => {
            remove(request, new Error('The browser guest did not attach in time.'), true);
          }, 10000),
        };
        requests.set(token, request);
        publish();
      });
    },
    present: (
      contentsId: number,
      bounds: Electron.Rectangle | null,
      painting: boolean,
      manual: boolean,
    ) => {
      const request = [...requests.values()].find((item) => item.guest?.id === contentsId);
      if (!request) return;
      const next = { ...request.view, bounds, painting, manual };
      if (JSON.stringify(next) === JSON.stringify(request.view)) return;
      request.view = structuredClone(next);
      publish();
    },
    resize: (contentsId: number, viewport: { width: number; height: number }) => {
      const request = [...requests.values()].find((item) => item.guest?.id === contentsId);
      if (
        !request ||
        (request.view.viewport?.width === viewport.width &&
          request.view.viewport.height === viewport.height)
      )
        return;
      request.view = { ...request.view, viewport: { ...viewport } };
      publish();
    },
    forget: (contentsId: number) => {
      const request = [...requests.values()].find((item) => item.guest?.id === contentsId);
      if (request) remove(request, new Error('The browser guest closed.'), false);
    },
    close: () => {
      if (closed) return;
      closed = true;
      reset();
      uninstall();
      ipcMain.removeHandler(domBrowserChannels.views);
      ipcMain.removeHandler(domBrowserChannels.register);
    },
  };
};
