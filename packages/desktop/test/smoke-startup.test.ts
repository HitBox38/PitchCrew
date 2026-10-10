import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, test, vi, type Mock } from 'vitest';

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
    }
  >,
  app: undefined as unknown as TestApp,
}));
vi.mock('electron', () => ({
  app: electron.app,
  BrowserWindow: class extends EventEmitter {
    static getAllWindows() {
      return electron.windows;
    }
    show = vi.fn();
    focus = vi.fn();
    restore = vi.fn();
    loadURL = vi.fn();
    webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() });
    constructor() {
      super();
      electron.windows.push(this);
    }
  },
  dialog: { showErrorBox: vi.fn() },
  ipcMain: new EventEmitter(),
  nativeImage: { createFromPath: vi.fn() },
  nativeTheme: { shouldUseDarkColors: false },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn() } },
  shell: {},
}));
vi.mock('../src/smoke.ts', () => ({ installSmokeCheck: vi.fn() }));
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
  vi.stubEnv('PITCHCREW_SMOKE_VISIBLE', '');
  vi.stubEnv('PITCHCREW_URL', 'http://127.0.0.1:14420');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function start() {
  await import('../src/main.ts');
  await Promise.resolve();
  const window = electron.windows[0];
  window.emit('ready-to-show');
  return window;
}

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
