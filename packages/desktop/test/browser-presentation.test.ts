import { EventEmitter } from 'node:events';
import { BrowserWindow, type BrowserWindowConstructorOptions, type WebContents } from 'electron';
import { afterEach, expect, it, vi } from 'vitest';
import { createNativeGroup, type NativeGroup } from '../src/browser/pages.ts';
import type { createDomBrowserHost } from '../src/browser/dom-host.ts';

type PopupOptions = BrowserWindowConstructorOptions & { webContents?: WebContents };
const mock = vi.hoisted(() => ({
  popupOptions: [] as PopupOptions[],
  popupInstances: [] as BrowserWindow[],
}));
vi.mock('electron', () => ({
  Menu: {},
  BrowserWindow: class {
    webContents: WebContents;
    destroyed = false;
    visible = false;
    focused = false;
    setIgnoreMouseEvents = vi.fn();
    setFocusable = vi.fn();
    show = vi.fn(() => {
      this.visible = true;
      this.focused = true;
    });
    showInactive = vi.fn(() => {
      this.visible = true;
    });
    hide = vi.fn(() => {
      this.visible = false;
      this.focused = false;
    });
    focus = vi.fn(() => {
      this.focused = true;
    });
    blur = vi.fn(() => {
      this.focused = false;
    });
    constructor(options: PopupOptions) {
      this.webContents = options.webContents!;
      mock.popupOptions.push(options);
      mock.popupInstances.push(this as unknown as BrowserWindow);
    }
    isDestroyed() {
      return this.destroyed;
    }
    isVisible() {
      return this.visible;
    }
    isFocused() {
      return this.focused;
    }
    destroy() {
      this.destroyed = true;
      if (!this.webContents.isDestroyed()) this.webContents.close();
    }
  },
  clipboard: {},
  session: {
    fromPartition: () => ({
      setPermissionCheckHandler: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
      webRequest: { onBeforeRequest: vi.fn() },
      on: vi.fn(),
    }),
  },
}));

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  mock.popupOptions.length = 0;
  mock.popupInstances.length = 0;
  vi.useRealTimers();
});

type WindowOpenHandler = Parameters<WebContents['setWindowOpenHandler']>[0];
const guest = (id: number, initialUrl = 'about:blank') => {
  let destroyed = false;
  const contents = Object.assign(new EventEmitter(), {
    id,
    isDestroyed: () => destroyed,
    getURL: () => initialUrl,
    getTitle: (): string => '',
    isLoadingMainFrame: () => false,
    navigationHistory: { clear: vi.fn() },
    setWindowOpenHandler: vi.fn<(handler: WindowOpenHandler) => void>(),
    debugger: {
      attach: vi.fn(),
      sendCommand: vi.fn(
        async (
          _method: string,
        ): Promise<{
          targetInfo: { targetId: string };
          frameTree?: { frame: { id: string } };
          executionContextId?: number;
        }> => ({
          targetInfo: { targetId: `page-${id}` },
          ...(_method === 'Page.getFrameTree'
            ? { frameTree: { frame: { id: `frame-${id}` } } }
            : {}),
          ...(_method === 'Page.createIsolatedWorld' ? { executionContextId: 1 } : {}),
        }),
      ),
    },
    loadURL: vi.fn(async (_url: string) => {}),
    close: vi.fn(() => {
      if (destroyed) return;
      destroyed = true;
      contents.emit('destroyed');
    }),
  });
  return {
    contents,
    asContents: contents as unknown as WebContents,
    handler: () => contents.setWindowOpenHandler.mock.calls.at(-1)![0],
  };
};

const enrollmentFixture = (visible = false) => {
  const dom = {
    present: vi.fn(),
    forget: vi.fn(),
    create: vi.fn<ReturnType<typeof createDomBrowserHost>['create']>(),
  };
  const window = { isVisible: () => visible } as BrowserWindow;
  const groups: NativeGroup[] = [];
  const group = createNativeGroup(
    'owner',
    'profile',
    () => window,
    () => groups,
    dom as unknown as ReturnType<typeof createDomBrowserHost>,
  );
  groups.push(group);
  cleanups.push(group.destroy);
  return { dom, group };
};

const fixture = () => {
  const dom = {
    present: vi.fn(),
    forget: vi.fn(),
    create: vi.fn<ReturnType<typeof createDomBrowserHost>['create']>(),
  };
  const window = { isVisible: () => false } as BrowserWindow;
  const groups = [0, 1].map((index) => {
    const group = createNativeGroup(
      'owner',
      `profile-${index}`,
      () => window,
      () => groups,
      dom as unknown as ReturnType<typeof createDomBrowserHost>,
    );
    const contents = guest(index + 1).asContents;
    group.pages.set(`tab-${index}`, { id: `tab-${index}`, contents, send: vi.fn() });
    group.owned.add(contents);
    group.active = `tab-${index}`;
    cleanups.push(group.destroy);
    return group;
  });
  return { dom, groups };
};
const bounds = { x: 50, y: 100, width: 700, height: 500 };

const popupFixture = async (visible = true) => {
  const { dom, group } = enrollmentFixture(visible);
  const parent = guest(70);
  dom.create.mockResolvedValueOnce(parent.asContents);
  await group.create();
  group.manualUntil = Date.now() + 1000;
  const child = guest(71, 'https://example.com/signin');
  const response = parent.handler()({
    url: 'https://example.com/signin',
    disposition: 'new-window',
  } as Electron.HandlerDetails);
  response.createWindow!({ webContents: child.asContents } as PopupOptions);
  await vi.waitFor(() => expect(group.active).toBe('page-71'));
  return { dom, group, child, popup: mock.popupInstances[0]! };
};

it('denies popup OS input during agent rendering and restores it only for a manual lease', async () => {
  const { group, popup, child } = await popupFixture();
  group.mount(bounds);
  expect(popup.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
  expect(popup.setFocusable).toHaveBeenLastCalledWith(true);
  expect(popup.isFocused()).toBe(true);
  group.manualUntil = 0;
  group.mount(bounds);
  group.paint(group.active, true);
  expect(popup.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true);
  expect(popup.setFocusable).toHaveBeenLastCalledWith(false);
  expect(popup.blur).toHaveBeenCalledOnce();
  expect(popup.isFocused()).toBe(false);
  expect(popup.isVisible()).toBe(true);
  await group.pages
    .get(group.active)!
    .send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
  expect(child.contents.debugger.sendCommand).toHaveBeenLastCalledWith('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 10,
    y: 10,
  });
  group.manualUntil = Date.now() + 1000;
  group.mount(bounds);
  expect(popup.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
  expect(popup.setFocusable).toHaveBeenLastCalledWith(true);
});

it('keeps popups nonfocusable and hidden when their parent fixture is hidden', async () => {
  const { group, popup } = await popupFixture(false);
  group.mount(bounds);
  expect(popup.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
  expect(popup.setFocusable).toHaveBeenLastCalledWith(false);
  expect(popup.show).not.toHaveBeenCalled();
  expect(popup.showInactive).not.toHaveBeenCalled();
  expect(popup.focus).not.toHaveBeenCalled();
  expect(popup.isVisible()).toBe(false);
});

it('revokes popup hardware input and republishes DOM denial at the exact lease deadline without activity', async () => {
  vi.useFakeTimers();
  const { group, popup, dom } = await popupFixture();
  group.mount(bounds);
  group.paint(group.active, true);
  dom.present.mockClear();
  await vi.advanceTimersByTimeAsync(group.manualUntil - Date.now() - 1);
  expect(popup.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
  expect(popup.setFocusable).toHaveBeenLastCalledWith(true);
  expect(dom.present).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(popup.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true);
  expect(popup.setFocusable).toHaveBeenLastCalledWith(false);
  expect(popup.blur).toHaveBeenCalledOnce();
  expect(dom.present).toHaveBeenCalledWith(71, bounds, true, false);
  expect(vi.getTimerCount()).toBe(0);
});

it('reschedules lease renewal and cancels its deadline when the group is destroyed', async () => {
  vi.useFakeTimers();
  const { group, popup, dom } = await popupFixture();
  group.mount(bounds);
  const originalDeadline = group.manualUntil;
  await vi.advanceTimersByTimeAsync(400);
  group.manualUntil = Date.now() + 2000;
  group.mount(bounds);
  await vi.advanceTimersByTimeAsync(originalDeadline - Date.now());
  expect(popup.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
  expect(popup.setFocusable).toHaveBeenLastCalledWith(true);
  await group.destroy();
  expect(vi.getTimerCount()).toBe(0);
  dom.present.mockClear();
  await vi.advanceTimersByTimeAsync(5000);
  expect(dom.present).not.toHaveBeenCalled();
});

it('keeps the selected DOM guest at its page bounds through automation activity', () => {
  const {
    dom,
    groups: [group],
  } = fixture();
  group.mount(bounds);
  dom.present.mockClear();
  for (let cycle = 0; cycle < 3; cycle++) {
    group.paint(group.active, true);
    group.paint(group.active, false);
  }
  expect(dom.present).toHaveBeenCalledTimes(6);
  for (const call of dom.present.mock.calls)
    expect(call).toEqual([1, bounds, expect.any(Boolean), false]);
  expect(dom.forget).not.toHaveBeenCalled();
});

it('renders background automation independently of the selected session and manual lease', () => {
  const {
    dom,
    groups: [background, selected],
  } = fixture();
  selected.manualUntil = Date.now() + 45000;
  selected.mount(bounds);
  background.paint(background.active, true);
  expect(dom.present).toHaveBeenLastCalledWith(1, null, true, false);
  expect(selected.bounds).toEqual(bounds);
  selected.mount(bounds);
  expect(dom.present).toHaveBeenLastCalledWith(2, bounds, false, true);
  background.paint(background.active, false);
  expect(dom.present).toHaveBeenLastCalledWith(1, null, false, false);
  selected.mount(null);
  expect(dom.present).toHaveBeenLastCalledWith(2, null, false, true);
  expect(dom.forget).not.toHaveBeenCalled();
});

it('closes a guest whose delayed creation finishes after its group is destroyed', async () => {
  const {
    dom,
    groups: [group],
  } = fixture();
  group.pages.clear();
  group.owned.clear();
  let finish: (contents: WebContents) => void = () => {};
  dom.create.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const creating = group.create();
  const rejected = expect(creating).rejects.toThrow('session is closed');
  group.destroy();
  const late = { id: 9, isDestroyed: () => false, close: vi.fn() };
  finish(late as unknown as WebContents);
  await rejected;
  expect(late.close).toHaveBeenCalledOnce();
  expect(dom.forget).toHaveBeenCalledWith(9);
  expect(group.owned.size).toBe(0);
});

it('keeps a newly attached guest private until its blank URL/title settle and clears bootstrap history', async () => {
  const { dom, group } = enrollmentFixture();
  const source = guest(40);
  let url = 'about:blank#pitchcrew-33e0562b-4723-4915-a1c2-8d524ee18894';
  vi.spyOn(source.contents, 'getURL').mockImplementation(() => url);
  vi.spyOn(source.contents, 'getTitle').mockImplementation(() =>
    url === 'about:blank' ? '' : url,
  );
  dom.create.mockResolvedValueOnce(source.asContents);
  const relay = { announce: vi.fn(), closed: vi.fn(), disconnect: vi.fn() };
  group.relays.add(relay);
  const creating = group.create();
  await vi.waitFor(() => expect(group.pages.size).toBe(1));
  expect(group.state().tabs).toEqual([]);
  expect(relay.announce).not.toHaveBeenCalled();
  url = 'about:blank';
  const page = await creating;
  expect(page.ready).toBe(true);
  expect(source.contents.navigationHistory.clear).toHaveBeenCalledOnce();
  expect(relay.announce).toHaveBeenCalledWith(page);
  await group.destroy();
});

it('waits for native tab destruction before returning its close operation', async () => {
  const { dom, group } = enrollmentFixture();
  const source = guest(41);
  dom.create.mockResolvedValueOnce(source.asContents);
  const page = await group.create();
  source.contents.close.mockImplementationOnce(() => {});
  let closed = false;
  const closing = group.close(page.id).then(() => {
    closed = true;
  });
  await vi.waitFor(() => expect(source.contents.close).toHaveBeenCalledOnce());
  expect(closed).toBe(false);
  expect(group.pages.has(page.id)).toBe(true);
  source.contents.emit('destroyed');
  await closing;
  expect(group.pages.size).toBe(0);
  await group.destroy();
});

it.each(['attach', 'target'] as const)(
  'releases a failed %s enrollment and its capacity',
  async (failure) => {
    const { dom, group } = enrollmentFixture();
    const failed = guest(10);
    if (failure === 'attach')
      failed.contents.debugger.attach.mockImplementationOnce(() => {
        throw new Error('Fixture debugger failure');
      });
    else
      failed.contents.debugger.sendCommand.mockRejectedValueOnce(
        new Error('Fixture debugger failure'),
      );
    dom.create.mockResolvedValueOnce(failed.asContents);
    await expect(group.create()).rejects.toThrow('Fixture debugger failure');
    expect(group.owned.size).toBe(0);
    expect(group.pages.size).toBe(0);
    expect(group.popupWindows.size).toBe(0);
    expect(dom.forget).toHaveBeenCalledWith(10);
    expect(failed.contents.close).toHaveBeenCalledOnce();

    const replacement = guest(11);
    dom.create.mockResolvedValueOnce(replacement.asContents);
    expect((await group.create()).contents).toBe(replacement.contents);
    expect(group.owned.size).toBe(1);
    expect(group.pages.size).toBe(1);
  },
);

it('does not announce or select a guest after destruction during asynchronous enrollment', async () => {
  const { dom, group } = enrollmentFixture();
  const pending = guest(10);
  let finish = (_value: { targetInfo: { targetId: string } }) => {};
  pending.contents.debugger.sendCommand.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  dom.create.mockResolvedValueOnce(pending.asContents);
  const relay = { announce: vi.fn(), closed: vi.fn(), disconnect: vi.fn() };
  group.relays.add(relay);
  const creating = group.create();
  const rejected = expect(creating).rejects.toThrow('session is closed');
  await vi.waitFor(() => expect(pending.contents.debugger.sendCommand).toHaveBeenCalled());
  group.destroy();
  finish({ targetInfo: { targetId: 'late-page' } });
  await rejected;
  expect(group.owned.size).toBe(0);
  expect(group.pages.size).toBe(0);
  expect(group.active).toBe('');
  expect(relay.announce).not.toHaveBeenCalled();
  expect(relay.disconnect).toHaveBeenCalledOnce();
});

it('reserves the 32-tab capacity while DOM creations are still waiting and returns failed reservations', async () => {
  const { dom, group } = enrollmentFixture();
  const rejectPending: ((error: Error) => void)[] = [];
  dom.create.mockImplementation(
    () => new Promise((_resolve, reject) => rejectPending.push(reject)),
  );
  const pending = Array.from({ length: 32 }, () => group.create().catch((error: unknown) => error));
  expect(group.owned.size).toBe(0);
  expect(dom.create).toHaveBeenCalledTimes(32);
  await expect(group.create()).rejects.toThrow('Close a browser tab');
  expect(dom.create).toHaveBeenCalledTimes(32);
  for (const reject of rejectPending) reject(new Error('Fixture attachment failure'));
  await Promise.all(pending);
  const replacement = guest(20);
  dom.create.mockResolvedValueOnce(replacement.asContents);
  expect((await group.create()).contents).toBe(replacement.contents);
  expect(group.owned.size).toBe(1);
});

it('keeps popup window features bounded and denies descendants before asynchronous enrollment', async () => {
  const { dom, group } = enrollmentFixture(true);
  const parent = guest(10);
  dom.create.mockResolvedValueOnce(parent.asContents);
  await group.create();
  group.manualUntil = Date.now() + 45000;
  const response = parent.handler()({ url: 'about:blank' } as Electron.HandlerDetails);
  expect(response.action).toBe('allow');
  expect(response.overrideBrowserWindowOptions).toMatchObject({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webviewTag: false,
      webSecurity: true,
    },
  });
  const child = guest(11, '');
  const websiteOptions: PopupOptions = {
    webContents: child.asContents,
    width: 99999,
    height: 1,
    frame: false,
    closable: false,
    alwaysOnTop: true,
    opacity: 0,
    skipTaskbar: true,
    title: 'Untrusted title',
    webPreferences: { preload: '/untrusted.js', nodeIntegration: true, webSecurity: false },
  };
  expect(response.createWindow!(websiteOptions)).toBe(child.contents);
  const options = mock.popupOptions[0];
  expect(options).toMatchObject({
    webContents: child.contents,
    title: 'Pitchcrew browser',
    width: 1440,
    height: 240,
    show: false,
    webPreferences: { preload: undefined, nodeIntegration: false, webSecurity: true },
  });
  for (const field of ['frame', 'closable', 'alwaysOnTop', 'opacity', 'skipTaskbar'] as const)
    expect(options[field]).toBeUndefined();
  expect(child.contents.debugger.attach).not.toHaveBeenCalled();
  expect(child.handler()({ url: 'about:blank' } as Electron.HandlerDetails)).toEqual({
    action: 'deny',
  });
  expect(mock.popupInstances).toHaveLength(1);
  child.contents.close();
  await vi.waitFor(() => expect(group.popupWindows.size).toBe(0));
  expect(group.owned.size).toBe(1);
  expect(group.pages.size).toBe(1);
  await vi.waitFor(() => expect(mock.popupInstances[0].isDestroyed()).toBe(true));
});
