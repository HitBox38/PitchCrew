import { guestAutomation } from './automation.ts';
import { browserWindowOpenAction } from './window-open.ts';
import { browserFavicon } from './favicon.ts';
import { browserIsFloating, closeFloatingBrowser } from './floating.ts';
import { drainNativeCapture } from './capture.ts';
import { nativeBrowserPageUrl } from './dom-protocol.ts';
import { nativeManualFields } from './manual.ts';
import {
  Menu,
  BrowserWindow,
  session,
  clipboard,
  screen,
  type WebContents,
  type Session,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { assertPublicUrl } from '../../../mcp/src/computer/network.ts';
import type { NativeBrowserState } from '../../../core/src/native-browser.ts';
import type { RelayGroup, RelayPage } from './cdp.ts';
import type { createDomBrowserHost } from './dom-host.ts';

const configured = new WeakSet<Session>();

export interface NativeGroup extends RelayGroup {
  create(existingContents?: WebContents, select?: boolean): Promise<RelayPage>;
  changed(): void;
  recover(id: string): Promise<boolean>;
  close(id: string): Promise<void>;
  appearance: Map<string, 'system' | 'light' | 'dark'>;
  mutate<T>(operation: () => Promise<T>): Promise<T>;
  id: string;
  profile: string;
  baseProfile: string;
  namedProfile: { id: string; name: string };
  active: string;
  manualUntil: number;
  manualFields: ReturnType<typeof nativeManualFields>;
  automatic: boolean;
  preparationBlocked: boolean;
  bounds: Electron.Rectangle | null;
  owned: Set<WebContents>;
  popupWindows: Map<number, BrowserWindow>;
  painting: Set<string>;
  paint(id: string, active: boolean): void;
  relays: Set<{ announce(page: RelayPage): void; closed(id: string): void; disconnect(): void }>;
  mount(bounds: Electron.Rectangle | null): void;
  select(id: string): void;
  state(): NativeBrowserState;
  destroy(): Promise<void>;
}

export const createNativeGroup = (
  ownerId: string,
  profile: string,
  getWindow: () => BrowserWindow | null,
  groups: () => Iterable<NativeGroup>,
  dom: ReturnType<typeof createDomBrowserHost>,
  baseProfile = profile,
  namedProfile = { id: 'default', name: 'Default' },
  notify?: (state: NativeBrowserState) => void,
) => {
  const partition = session.fromPartition(`persist:pitchcrew-browser-${profile}`);
  const popupPreferences: Electron.WebPreferences = {
    session: partition,
    preload: undefined,
    additionalArguments: [],
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webviewTag: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    backgroundThrottling: false,
    autoplayPolicy: 'user-gesture-required',
  };
  const errors = new Map<string, string>();
  const crashed = new Set<string>();
  const addresses = new Map<string, string>();
  const logicalTabs = new Map<string, string>();
  const favicons = new Map<string, string>();
  const iconRequests = new Map<string, AbortController>();
  const closing = new Set<string>();
  let mutations = Promise.resolve();
  let notification: ReturnType<typeof setTimeout> | undefined;
  let manualExpiry: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let destruction: Promise<void> | undefined;
  let pendingCreates = 0;
  const group: NativeGroup = {
    id: randomUUID(),
    profile,
    baseProfile,
    namedProfile,
    active: '',
    appearance: new Map(),
    changed: () => {
      if (notification || disposed || !notify) return;
      notification = setTimeout(() => {
        notification = undefined;
        if (!disposed) notify(group.state());
      }, 16);
    },
    mutate: (operation) => {
      const pending = mutations.then(() => {
        if (disposed) throw new Error('Browser session is closed.');
        return operation();
      });
      mutations = pending.then(
        () => {},
        () => {},
      );
      return pending;
    },
    manualUntil: 0,
    manualFields: nativeManualFields(),
    automatic: true,
    preparationBlocked: false,
    bounds: null,
    pages: new Map(),
    owned: new Set(),
    popupWindows: new Map(),
    painting: new Set(),
    relays: new Set(),
    create: async (existingContents, select = true) => {
      if (disposed) throw new Error('Browser session is closed.');
      if (group.owned.size + pendingCreates >= 32)
        throw new Error('Close a browser tab before opening another.');
      pendingCreates++;
      let reserved = true;
      let created: WebContents | undefined;
      let id: string | undefined;
      let cleaned = false;
      const cleanup = () => {
        if (cleaned || !created) return;
        cleaned = true;
        group.owned.delete(created);
        group.popupWindows.delete(created.id);
        dom.forget(created.id);
        if (!id) return;
        errors.delete(id);
        crashed.delete(id);
        addresses.delete(id);
        logicalTabs.delete(id);
        favicons.delete(id);
        group.appearance.delete(id);
        iconRequests.get(id)?.abort();
        iconRequests.delete(id);
        group.pages.delete(id);
        group.painting.delete(id);
        for (const relay of group.relays) relay.closed(id);
        if (group.active === id) {
          group.active = [...group.pages.keys()].at(-1) ?? '';
          group.mount(group.bounds);
        }
        group.changed();
      };
      try {
        const contents =
          existingContents ?? (await dom.create(`persist:pitchcrew-browser-${profile}`));
        created = contents;
        pendingCreates--;
        reserved = false;
        if (disposed || contents.isDestroyed()) throw new Error('Browser session is closed.');
        group.owned.add(contents);
        contents.once('destroyed', cleanup);
        contents.setWindowOpenHandler(() => ({ action: 'deny' }));
        if (existingContents && !contents.getURL())
          await new Promise<void>((resolve, reject) => {
            const clear = () => {
              clearTimeout(timeout);
              contents.removeListener('dom-ready', ready);
              contents.removeListener('destroyed', closed);
            };
            const ready = () => {
              clear();
              resolve();
            };
            const closed = () => {
              clear();
              reject(new Error('The popup closed before loading.'));
            };
            const timeout = setTimeout(() => {
              clear();
              reject(new Error('The popup did not load.'));
            }, 5000);
            contents.once('dom-ready', ready);
            contents.once('destroyed', closed);
          });
        if (disposed || contents.isDestroyed()) throw new Error('Browser session is closed.');
        contents.debugger.attach('1.3');
        // Private input tracking can run before a Playwright client attaches to a
        // user-created tab. Isolated worlds require the Page domain to be ready.
        await contents.debugger.sendCommand('Page.enable');
        const target = await contents.debugger.sendCommand('Target.getTargetInfo');
        if (disposed || contents.isDestroyed()) throw new Error('Browser session is closed.');
        const pageId = String(target.targetInfo.targetId);
        id = pageId;
        const automation = guestAutomation(
          contents,
          (active) => group.paint(pageId, active),
          () => {
            const window = group.popupWindows.get(contents.id) ?? getWindow();
            return window ? screen.getDisplayMatching(window.getBounds()).scaleFactor : 1;
          },
        );
        const page: RelayPage = {
          id: pageId,
          ready: false,
          openerId: target.targetInfo.openerId,
          contents,
          releaseAutomation: automation.release,
          send: (method, params, child, owner) => {
            if (disposed || closing.has(pageId))
              return Promise.reject(new Error('Browser tab is closing.'));
            const popup = group.popupWindows.get(contents.id);
            if (!child && method === 'Emulation.setDeviceMetricsOverride') {
              const { width, height } = params;
              if (
                typeof width === 'number' &&
                Number.isInteger(width) &&
                width > 0 &&
                width <= 2560 &&
                typeof height === 'number' &&
                Number.isInteger(height) &&
                height > 0 &&
                height <= 2160
              ) {
                popup?.setContentSize(width, height);
                dom.resize(contents.id, { width, height });
              }
            }
            return automation.send(method, params, child, owner);
          },
        };
        logicalTabs.set(pageId, pageId);
        group.pages.set(pageId, page);
        const canUse = () => group.manualUntil > Date.now();
        contents.on('before-input-event', (event, input) => {
          if (!canUse() && !automation.active) {
            event.preventDefault();
            return;
          }
          if (!canUse() || input.type !== 'keyDown' || input.isComposing) return;
          const key = input.key.toLowerCase();
          const primary =
            process.platform === 'darwin'
              ? input.meta && !input.control
              : input.control && !input.meta;
          const navigate =
            (input.alt &&
              !input.meta &&
              !input.control &&
              ['arrowleft', 'arrowright'].includes(key)) ||
            (process.platform === 'darwin' && input.meta && !input.alt && ['[', ']'].includes(key));
          const shortcut = navigate ? (['arrowleft', '['].includes(key) ? 'back' : 'forward') : key;
          if (
            navigate ||
            (input.control && !input.meta && !input.alt && key === 'tab') ||
            (primary && !input.alt && ['t', 'w', 'l', 'f', 'r', '+', '=', '-', '0'].includes(key))
          ) {
            if (input.isAutoRepeat && ['t', 'w'].includes(key)) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            getWindow()?.webContents.send('pitchcrew:browser:shortcut', {
              id: group.id,
              key: shortcut,
              shift: input.shift,
            });
            getWindow()?.webContents.focus();
          }
        });
        contents.on('before-mouse-event', (event) => {
          if (!canUse() && !automation.active) event.preventDefault();
        });
        contents.on('context-menu', (_event, params) => {
          if (!canUse()) return;
          const template: Electron.MenuItemConstructorOptions[] = [];
          if (params.isEditable)
            template.push(
              { role: 'undo' },
              { role: 'redo' },
              { type: 'separator' },
              { role: 'cut' },
              { role: 'copy' },
              { role: 'paste' },
              { role: 'selectAll' },
            );
          else if (params.selectionText) template.push({ role: 'copy' }, { role: 'selectAll' });
          if (params.linkURL.startsWith('https:') || params.linkURL.startsWith('http:'))
            template.push(
              {
                label: 'Open link in new tab',
                click: () => {
                  void group
                    .create()
                    .then((created) => created.contents.loadURL(params.linkURL))
                    .catch(() => {});
                },
              },
              {
                label: 'Copy link address',
                click: () => {
                  clipboard.writeText(params.linkURL);
                },
              },
            );
          if (!template.length)
            template.push(
              {
                label: 'Back',
                enabled: contents.navigationHistory.canGoBack(),
                click: () => contents.navigationHistory.goBack(),
              },
              {
                label: 'Forward',
                enabled: contents.navigationHistory.canGoForward(),
                click: () => contents.navigationHistory.goForward(),
              },
              { label: 'Reload', click: () => contents.reload() },
            );
          const menu = Menu.buildFromTemplate(template);
          menu.popup({ window: getWindow() ?? undefined });
        });
        contents.on('dom-ready', () => {
          if (canUse() && !crashed.has(pageId))
            void group.manualFields.begin(contents, group.manualUntil).catch(() => {});
        });
        contents.on('did-frame-finish-load', () => {
          if (canUse() && !crashed.has(pageId))
            void group.manualFields.begin(contents, group.manualUntil).catch(() => {});
        });
        contents.setWindowOpenHandler((details) => {
          const { url } = details;
          const action = browserWindowOpenAction(details);
          if (action === 'deny') return { action: 'deny' };
          if ((!canUse() && !automation.active) || group.owned.size + pendingCreates >= 32)
            return { action: 'deny' };
          if (action === 'tab') {
            void group
              .mutate(async () => {
                const tab = await group.create(undefined, details.disposition !== 'background-tab');
                await tab.contents.loadURL(url);
              })
              .catch(() => {});
            return { action: 'deny' };
          }
          // Real child webContents preserve window.opener for sign-in and application popups.
          return {
            action: 'allow',
            overrideBrowserWindowOptions: { show: false, webPreferences: popupPreferences },
            createWindow: (options) => {
              const parent = getWindow();
              const popup = new BrowserWindow({
                ...('webContents' in options ? { webContents: options.webContents } : {}),
                title: 'Pitchcrew browser',
                show: false,
                width: Math.max(320, Math.min(1440, options.width ?? 800)),
                height: Math.max(240, Math.min(1000, options.height ?? 600)),
                ...(!parent?.isVisible() ? { focusable: false, skipTaskbar: true } : {}),
                autoHideMenuBar: true,
                webPreferences: popupPreferences,
              });
              popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
              popup.webContents.on('page-title-updated', (event) => event.preventDefault());
              const popupId = popup.webContents.id;
              group.popupWindows.set(popupId, popup);
              void group.create(popup.webContents).catch(() => {
                group.popupWindows.delete(popupId);
                if (!popup.isDestroyed()) popup.destroy();
              });
              return popup.webContents;
            },
          };
        });
        contents.on('did-start-loading', group.changed);
        contents.on('did-stop-loading', group.changed);
        contents.on('did-navigate', (_event, url) => {
          addresses.set(pageId, url);
          group.changed();
        });
        contents.on('did-navigate-in-page', (_event, url) => {
          addresses.set(pageId, url);
          group.changed();
        });
        contents.on('page-title-updated', group.changed);
        contents.on('audio-state-changed', group.changed);
        contents.on('page-favicon-updated', (_event, urls) => {
          iconRequests.get(pageId)?.abort();
          const controller = new AbortController();
          iconRequests.set(pageId, controller);
          if (!urls[0]) return;
          void browserFavicon(
            urls[0],
            AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]),
          )
            .then((icon) => {
              if (!icon || controller.signal.aborted || disposed || contents.isDestroyed()) return;
              favicons.set(pageId, icon);
              group.changed();
            })
            .catch(() => {});
        });
        contents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
          if (mainFrame) {
            if (!crashed.has(pageId)) errors.delete(pageId);
            if (!inPlace) {
              favicons.delete(pageId);
              iconRequests.get(pageId)?.abort();
            }
            group.changed();
          }
        });
        contents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
          if (mainFrame && code !== -3)
            errors.set(
              pageId,
              `The page could not load (error ${code}). Check the address or reload.`,
            );
          group.changed();
        });
        contents.on('render-process-gone', () => {
          crashed.add(pageId);
          errors.set(pageId, 'This browser tab stopped responding. Reload to recover it.');
          group.changed();
        });
        contents.on('will-attach-webview', (event) => event.preventDefault());
        contents.on('will-navigate', (event, url) => {
          if (url !== 'about:blank' && !/^https?:\/\//i.test(url)) event.preventDefault();
        });
        if (!existingContents) {
          await contents.loadURL('about:blank');
          // Chromium can resolve a fragment-only blank navigation before the
          // browser-process URL/title catch up. Never publish its bootstrap nonce.
          const deadline = Date.now() + 2000;
          while (
            contents.getURL() !== 'about:blank' ||
            contents.getTitle().startsWith('about:blank#pitchcrew-') ||
            contents.isLoadingMainFrame()
          ) {
            if (disposed || contents.isDestroyed() || Date.now() >= deadline)
              throw new Error('The browser tab did not finish opening.');
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          contents.navigationHistory.clear();
        }
        if (canUse()) await group.manualFields.begin(contents, group.manualUntil);
        if (disposed || contents.isDestroyed()) throw new Error('Browser session is closed.');
        page.ready = true;
        addresses.set(pageId, contents.getURL());
        for (const relay of group.relays) relay.announce(page);
        if (select || !group.active) group.select(pageId);
        else group.changed();
        return page;
      } catch (error) {
        const popup = created && group.popupWindows.get(created.id);
        cleanup();
        if (popup && !popup.isDestroyed()) popup.destroy();
        else if (created && !created.isDestroyed()) created.close();
        throw error;
      } finally {
        if (reserved) pendingCreates--;
      }
    },
    close: async (id) => {
      const page = group.pages.get(id);
      if (!page || page.contents.isDestroyed()) return;
      closing.add(id);
      try {
        await drainNativeCapture(page.contents);
        if (page.contents.isDestroyed()) return;
        await new Promise<void>((resolve, reject) => {
          const done = () => {
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(() => {
            page.contents.removeListener('destroyed', done);
            reject(new Error('The browser tab did not close.'));
          }, 5000);
          page.contents.once('destroyed', done);
          page.contents.close();
        });
      } finally {
        closing.delete(id);
      }
    },
    recover: async (id) => {
      if (!crashed.has(id)) return false;
      const page = group.pages.get(id);
      if (!page) throw new Error('Browser tab is closed.');
      const url = nativeBrowserPageUrl(addresses.get(id) ?? page.contents.getURL());
      if (url !== 'about:blank') await assertPublicUrl(url);
      const selected = group.active === id;
      const logicalId = logicalTabs.get(id) ?? id;
      // A crashed Playwright Page and its OOPIF sessions are terminal. Follow
      // T3's guest generation recovery instead of reviving that debugger state.
      await group.close(id);
      const replacement = await group.create(undefined, selected);
      logicalTabs.set(replacement.id, logicalId);
      if (url !== 'about:blank') await replacement.contents.loadURL(url);
      group.changed();
      return true;
    },
    select: (id) => {
      if (!group.pages.has(id)) throw new Error('Browser tab is closed.');
      group.active = id;
      group.mount(group.bounds);
      group.changed();
      const popup = group.popupWindows.get(group.pages.get(id)!.contents.id);
      if (group.manualUntil > Date.now() && getWindow()?.isVisible() && popup?.isVisible())
        popup.focus();
    },
    paint: (id, active) => {
      if (disposed) return;
      if (group.painting.has(id) === active) return;
      if (active) group.painting.add(id);
      else group.painting.delete(id);
      group.mount(group.bounds);
    },
    mount: (bounds) => {
      group.bounds = bounds;
      const window = getWindow();
      const now = Date.now();
      const manual = group.manualUntil > now;
      clearTimeout(manualExpiry);
      manualExpiry = undefined;
      if (manual && !disposed) {
        manualExpiry = setTimeout(() => {
          manualExpiry = undefined;
          if (disposed) return;
          group.mount(group.bounds);
          group.changed();
        }, group.manualUntil - now);
        manualExpiry.unref();
      }
      for (const [id, page] of group.pages) {
        const selected = !!bounds && id === group.active;
        dom.present(page.contents.id, selected ? bounds : null, group.painting.has(id), manual);
        const popup = group.popupWindows.get(page.contents.id);
        if (!popup || popup.isDestroyed()) continue;
        // Popup windows do not have the DOM guest's read-only shield. Deny OS
        // input independently of agent rendering, without blocking owned CDP input.
        popup.setIgnoreMouseEvents(!manual);
        popup.setFocusable(manual && !!window?.isVisible());
        // On macOS setFocusable(false) alone leaves an already focused window focused.
        if (!manual && popup.isFocused()) popup.blur();
        if (selected && window?.isVisible()) {
          if (!popup.isVisible()) {
            if (manual) popup.show();
            else popup.showInactive();
          }
        } else if (popup.isVisible()) popup.hide();
      }
    },
    state: () => ({
      id: group.id,
      ownerId,
      profile: { ...group.namedProfile, workspaceKey: group.baseProfile },
      activeTab: group.active,
      tabs: [...group.pages.values()]
        .filter((page) => page.ready !== false)
        .map(({ id, contents }) => ({
          id,
          logicalId: logicalTabs.get(id) ?? id,
          title: contents.getTitle(),
          url: nativeBrowserPageUrl(contents.getURL()),
          loading: contents.isLoadingMainFrame(),
          zoomFactor: contents.getZoomFactor(),
          muted: contents.isAudioMuted(),
          floating: browserIsFloating(contents.id),
          audible: contents.isCurrentlyAudible(),
          colorScheme: group.appearance.get(id) ?? 'system',
          ...(favicons.has(id) ? { favicon: favicons.get(id)! } : {}),
          ...(group.popupWindows.has(contents.id) ? { window: true } : {}),
          ...(errors.has(id) ? { error: errors.get(id)! } : {}),
          ...(crashed.has(id) ? { crashed: true } : {}),
          canGoBack: contents.navigationHistory.canGoBack(),
          canGoForward: contents.navigationHistory.canGoForward(),
        })),
    }),
    destroy: () => {
      if (disposed) return destruction ?? Promise.resolve();
      disposed = true;
      group.manualUntil = 0;
      group.automatic = true;
      clearTimeout(notification);
      clearTimeout(manualExpiry);
      manualExpiry = undefined;
      for (const controller of iconRequests.values()) controller.abort();
      iconRequests.clear();
      // Keep actual native copies paintable until they finish, even after their
      // relay/viewer has released its own hold. Do not remove their DOM nodes early.
      for (const id of group.pages.keys()) group.painting.add(id);
      group.mount(null);
      destruction = Promise.resolve().then(async () => {
        closeFloatingBrowser(group);
        for (const relay of group.relays) relay.disconnect();
        const pages = new Set([...group.pages.values()].map((page) => page.contents));
        for (const contents of [...group.owned])
          if (!pages.has(contents) && !contents.isDestroyed()) contents.close();
        await Promise.all([...group.pages.keys()].map((id) => group.close(id)));
        group.painting.clear();
        group.mount(null);
      });
      // Synchronous lifecycle listeners also call destroy; their errors remain
      // observed while HTTP/shutdown callers can await the same failing operation.
      void destruction.catch(() => {});
      return destruction;
    },
  };
  if (!configured.has(partition)) {
    configured.add(partition);
    const ownerOf = (id: number | undefined) =>
      [...groups()].find((item) => [...item.owned].some((contents) => contents.id === id));
    partition.setPermissionCheckHandler(
      (_contents, permission) => permission === 'clipboard-sanitized-write',
    );
    partition.setPermissionRequestHandler((_contents, permission, callback) =>
      callback(permission === 'clipboard-sanitized-write'),
    );
    partition.webRequest.onBeforeRequest((details, callback) => {
      const owner = ownerOf(details.webContentsId);
      if (!owner) {
        callback({ cancel: true });
        return;
      }
      const converted = details.url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
      if (
        owner.automatic &&
        owner.manualUntil <= Date.now() &&
        !['GET', 'HEAD'].includes(details.method)
      ) {
        owner.preparationBlocked = true;
        callback({ cancel: true });
        return;
      }
      void assertPublicUrl(converted).then(
        () => callback({ cancel: false }),
        () => callback({ cancel: true }),
      );
    });
    partition.on('will-download', (event, _item, contents) => {
      if (!contents || !ownerOf(contents.id) || ownerOf(contents.id)!.manualUntil <= Date.now())
        event.preventDefault();
    });
  }
  return group;
};
