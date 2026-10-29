import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, test, vi, type Mock } from 'vitest';

const start = async () => {
  await import('../src/main.ts');
  await vi.waitFor(() => expect(electron.windows).toHaveLength(1));
  const window = electron.windows[0];
  window.emit('ready-to-show');
  return window;
};

type TestApp = EventEmitter & {
  setName: Mock;
  setPath: Mock;
  setActivationPolicy: Mock;
  requestSingleInstanceLock: Mock;
  whenReady: Mock<() => Promise<void>>;
  quit: Mock;
  exit: Mock;
  isPackaged: boolean;
  dock: { setIcon: Mock };
};

const electron = vi.hoisted(() => ({
  windows: [] as Array<
    EventEmitter & {
      show: ReturnType<typeof vi.fn>;
      focus: ReturnType<typeof vi.fn>;
      restore: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      isDestroyed: ReturnType<typeof vi.fn>;
    }
  >,
  app: undefined as unknown as TestApp,
  native: {
    dom: { install: vi.fn() },
    register: vi.fn(async () => {}),
    closeGuests: vi.fn<() => Promise<void>>(async () => {}),
    hasGuests: vi.fn(() => false),
  },
}));
vi.mock('electron', () => ({
  app: electron.app,
  BrowserWindow: class extends EventEmitter {
    static getAllWindows = () => {
      return electron.windows;
    };
    show = vi.fn();
    focus = vi.fn();
    restore = vi.fn();
    close = vi.fn();
    isDestroyed = vi.fn(() => false);
    loadURL = vi.fn();
    webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() });
    constructor() {
      super();
      electron.windows.push(this);
    }
  },
  dialog: { showErrorBox: vi.fn() },
  ipcMain: Object.assign(new EventEmitter(), { handle: vi.fn() }),
  nativeImage: { createFromPath: vi.fn() },
  nativeTheme: { shouldUseDarkColors: false },
  session: {
    defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() },
  },
  shell: {},
}));
vi.mock('../src/browser/lifecycle.ts', () => ({
  startNativeBrowsers: vi.fn(async () => electron.native),
}));
vi.mock('../src/smoke.ts', () => ({ installSmokeCheck: vi.fn() }));
vi.mock('../src/updates/index.ts', () => ({
  registerDesktopUpdates: vi.fn(async () => ({ isInstalling: () => false })),
}));
vi.mock('../src/packaged.ts', () => ({
  startPackagedDaemon: vi.fn(),
  stopPackagedDaemon: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  electron.windows = [];
  const app = electron.app ?? new EventEmitter();
  app.removeAllListeners();
  electron.app = Object.assign(app, {
    setName: vi.fn(),
    setPath: vi.fn(),
    setActivationPolicy: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    whenReady: vi.fn(async () => {}),
    quit: vi.fn(),
    exit: vi.fn(),
    isPackaged: false,
    dock: { setIcon: vi.fn() },
  });
  vi.stubEnv('PITCHCREW_SMOKE_FILE', '');
  vi.stubEnv('PITCHCREW_E2E_FILE', '');
  vi.stubEnv('PITCHCREW_SMOKE_VISIBLE', '');
  vi.stubEnv('PITCHCREW_URL', 'http://127.0.0.1:14420');
  vi.stubEnv('PITCHCREW_OWNS_DAEMON', '0');
  electron.native.hasGuests.mockReturnValue(false);
  electron.native.closeGuests.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('smoke startup and second-instance events never show or focus the window', async () => {
  vi.stubEnv('PITCHCREW_SMOKE_FILE', '/tmp/pitchcrew-fixture/result.json');
  const window = await start();
  electron.app.emit('second-instance');
  expect(window.show).not.toHaveBeenCalled();
  expect(window.restore).not.toHaveBeenCalled();
  expect(window.focus).not.toHaveBeenCalled();
  if (process.platform === 'darwin')
    expect(electron.app.setActivationPolicy).toHaveBeenCalledWith('accessory');
});

test('E2E startup stays hidden and isolates desktop data', async () => {
  vi.stubEnv('PITCHCREW_SMOKE_FILE', undefined);
  vi.stubEnv('PITCHCREW_E2E_FILE', '/tmp/pitchcrew-e2e-fixture/result.json');
  const window = await start();
  electron.app.emit('second-instance');
  expect(window.show).not.toHaveBeenCalled();
  expect(window.focus).not.toHaveBeenCalled();
  expect(electron.app.setPath).toHaveBeenCalledWith('userData', '/tmp/pitchcrew-e2e-fixture');
});

test.each([false, true])(
  'normal startup and visible smoke debugging still show the app (smoke=%s)',
  async (smoke) => {
    if (smoke) {
      vi.stubEnv('PITCHCREW_SMOKE_FILE', '/tmp/pitchcrew-fixture/result.json');
      vi.stubEnv('PITCHCREW_SMOKE_VISIBLE', '1');
    }
    const window = await start();
    electron.app.emit('second-instance');
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(electron.app.setActivationPolicy).not.toHaveBeenCalled();
  },
);

test('hidden smoke startup failures exit without a native error dialog', async () => {
  vi.stubEnv('PITCHCREW_SMOKE_FILE', '/tmp/pitchcrew-fixture/result.json');
  const error = new Error('Fixture startup failure');
  electron.app.whenReady.mockRejectedValue(error);
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  await import('../src/main.ts');
  await Promise.resolve();
  const { dialog } = await import('electron');
  expect(dialog.showErrorBox).not.toHaveBeenCalled();
  expect(logged).toHaveBeenCalledWith('Pitchcrew smoke startup failed:', error);
  expect(electron.app.exit).toHaveBeenCalledWith(1);
});

test('closing a hidden window waits for owned browser captures before native destruction', async () => {
  vi.stubEnv('PITCHCREW_SMOKE_FILE', '/tmp/pitchcrew-fixture/result.json');
  const window = await start();
  let finish!: () => void;
  electron.native.hasGuests.mockReturnValue(true);
  electron.native.closeGuests.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const event = { preventDefault: vi.fn() };
  window.emit('close', event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(window.close).not.toHaveBeenCalled();
  finish();
  await vi.waitFor(() => expect(window.close).toHaveBeenCalledOnce());
  expect(window.show).not.toHaveBeenCalled();
  expect(window.focus).not.toHaveBeenCalled();
});

test('quitting waits for owned browser cleanup before allowing the normal app quit', async () => {
  await start();
  let finish!: () => void;
  electron.native.hasGuests.mockReturnValue(true);
  electron.native.closeGuests.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const event = { preventDefault: vi.fn() };
  electron.app.emit('before-quit', event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(electron.app.quit).not.toHaveBeenCalled();
  finish();
  await vi.waitFor(() => expect(electron.app.quit).toHaveBeenCalledOnce());
  expect(electron.app.exit).not.toHaveBeenCalled();
});
