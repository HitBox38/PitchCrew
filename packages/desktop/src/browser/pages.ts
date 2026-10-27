import { guestAutomation } from './automation.ts';
import { nativeManualFields } from './manual.ts';
import {
  Menu,
  WebContentsView,
  session,
  clipboard,
  type BrowserWindow,
  type Session,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { assertPublicUrl } from '../../../mcp/src/computer/network.ts';
import type { NativeBrowserState } from '../../../core/src/native-browser.ts';
import type { RelayGroup, RelayPage } from './cdp.ts';

const configured = new WeakSet<Session>();

export interface NativeGroup extends RelayGroup {
  create(existingView?: WebContentsView): Promise<RelayPage>;
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
  views: Map<string, WebContentsView>;
  painting: Set<string>;
  paint(id: string, active: boolean): void;
  relays: Set<{ announce(page: RelayPage): void; closed(id: string): void; disconnect(): void }>;
  mount(bounds: Electron.Rectangle | null): void;
  select(id: string): void;
  state(): NativeBrowserState;
  destroy(): void;
}

export const createNativeGroup = (
  ownerId: string,
  profile: string,
  getWindow: () => BrowserWindow | null,
  groups: () => Iterable<NativeGroup>,
  baseProfile = profile,
  namedProfile = { id: 'default', name: 'Default' },
) => {
  const partition = session.fromPartition(`persist:pitchcrew-browser-${profile}`);
  const errors = new Map<string, string>();
  const group: NativeGroup = {
    id: randomUUID(),
    profile,
    baseProfile,
    namedProfile,
    active: '',
    manualUntil: 0,
    manualFields: nativeManualFields(),
    automatic: true,
    preparationBlocked: false,
    bounds: null,
    pages: new Map(),
    views: new Map(),
    painting: new Set(),
    relays: new Set(),
    create: async (existingView) => {
      if (group.pages.size >= 32) throw new Error('Close a browser tab before opening another.');
      const view =
        existingView ??
        new WebContentsView({
          webPreferences: {
            session: partition,
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            backgroundThrottling: false,
            autoplayPolicy: 'user-gesture-required',
          },
        });
      view.setVisible(false);
      view.setBounds({ x: 0, y: 0, width: 1280, height: 800 });
      const contents = view.webContents;
      group.views.set(`pending-${contents.id}`, view);
      if (existingView && !contents.getURL())
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('The popup did not load.')), 5000);
          contents.once('dom-ready', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      contents.debugger.attach('1.3');
      const target = await contents.debugger.sendCommand('Target.getTargetInfo');
      const id = String(target.targetInfo.targetId);
      const automation = guestAutomation(contents, (active) => group.paint(id, active));
      const page: RelayPage = {
        id,
        openerId: target.targetInfo.openerId,
        contents,
        send: automation.send,
      };
      group.views.delete(`pending-${contents.id}`);
      group.pages.set(id, page);
      group.views.set(id, view);
      const canUse = () => group.manualUntil > Date.now();
      contents.on('before-input-event', (event, input) => {
        if (!canUse() && !automation.active) {
          event.preventDefault();
          return;
        }
        if (!canUse() || !(input.control || input.meta) || input.type !== 'keyDown') return;
        const key = input.key.toLowerCase();
        if (['t', 'w', 'l', 'f', 'r', 'tab', '+', '=', '-', '0'].includes(key)) {
          event.preventDefault();
          getWindow()?.webContents.send('pitchcrew:browser:shortcut', {
            id: group.id,
            key,
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
        if (canUse()) void group.manualFields.begin(contents, group.manualUntil).catch(() => {});
      });
      contents.on('did-frame-finish-load', () => {
        if (canUse()) void group.manualFields.begin(contents, group.manualUntil).catch(() => {});
      });
      contents.setWindowOpenHandler(({ url }) => {
        if (url !== 'about:blank' && !/^https?:\/\//i.test(url)) return { action: 'deny' };
        if (!canUse() && !automation.active) return { action: 'deny' };
        // Real child webContents preserve window.opener for sign-in and application popups.
        return {
          action: 'allow',
          createWindow: (options) => {
            const popup = new WebContentsView({
              ...options,
              webPreferences: {
                ...options.webPreferences,
                session: partition,
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
              },
            });
            popup.setBounds(group.bounds ?? { x: 0, y: 0, width: 1280, height: 800 });
            getWindow()?.contentView.addChildView(popup, 0);
            void group.create(popup).catch(() => {
              if (!popup.webContents.isDestroyed()) popup.webContents.close();
            });
            return popup.webContents;
          },
        };
      });
      contents.on('did-start-navigation', (_event, _url, _inPlace, mainFrame) => {
        if (mainFrame) errors.delete(id);
      });
      contents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
        if (mainFrame && code !== -3)
          errors.set(id, `The page could not load (error ${code}). Check the address or reload.`);
      });
      contents.on('render-process-gone', () =>
        errors.set(id, 'This browser tab stopped responding. Reload to recover it.'),
      );
      contents.on('will-attach-webview', (event) => event.preventDefault());
      contents.on('will-navigate', (event, url) => {
        if (url !== 'about:blank' && !/^https?:\/\//i.test(url)) event.preventDefault();
      });
      contents.once('destroyed', () => {
        errors.delete(id);
        group.pages.delete(id);
        group.views.delete(id);
        for (const relay of group.relays) relay.closed(id);
        if (group.active === id) {
          group.active = [...group.pages.keys()].at(-1) ?? '';
          group.mount(group.bounds);
        }
      });
      if (!existingView) await contents.loadURL('about:blank');
      if (canUse()) await group.manualFields.begin(contents, group.manualUntil);
      for (const relay of group.relays) relay.announce(page);
      group.select(id);
      return page;
    },
    close: (id) => {
      group.pages.get(id)?.contents.close();
    },
    select: (id) => {
      if (!group.pages.has(id)) throw new Error('Browser tab is closed.');
      group.active = id;
      group.mount(group.bounds);
    },
    paint: (id, active) => {
      if (group.painting.has(id) === active) return;
      if (active) group.painting.add(id);
      else group.painting.delete(id);
      group.mount(group.bounds);
    },
    mount: (bounds) => {
      group.bounds = bounds;
      const window = getWindow();
      for (const [id, view] of group.views) {
        view.setVisible(false);
        if (window?.contentView.children.includes(view)) window.contentView.removeChildView(view);
        if (window && bounds && id === group.active) {
          window.contentView.addChildView(view);
          view.setBounds(bounds);
          view.setVisible(true);
        } else if (window && group.painting.has(id)) {
          window.contentView.addChildView(view, 0);
          view.setVisible(true);
        }
      }
    },
    state: () => ({
      id: group.id,
      ownerId,
      profile: group.namedProfile,
      activeTab: group.active,
      tabs: [...group.pages.values()].map(({ id, contents }) => ({
        id,
        title: contents.getTitle(),
        url: contents.getURL(),
        loading: contents.isLoading(),
        zoomFactor: contents.getZoomFactor(),
        ...(errors.has(id) ? { error: errors.get(id)! } : {}),
        canGoBack: contents.navigationHistory.canGoBack(),
        canGoForward: contents.navigationHistory.canGoForward(),
      })),
    }),
    destroy: () => {
      for (const relay of group.relays) relay.disconnect();
      group.painting.clear();
      group.mount(null);
      for (const page of [...group.pages.values()]) page.contents.close();
    },
  };
  if (!configured.has(partition)) {
    configured.add(partition);
    const ownerOf = (id: number | undefined) =>
      [...groups()].find((item) =>
        [...item.views.values()].some((view) => view.webContents.id === id),
      );
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
