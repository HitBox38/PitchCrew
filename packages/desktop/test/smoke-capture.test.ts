import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import type { BrowserWindow, NativeImage } from 'electron';
import { afterEach, expect, test, vi } from 'vitest';
import { installSmokeCheck } from '../src/smoke.ts';

vi.mock('electron', () => ({
  app: { quit: vi.fn(), exit: vi.fn() },
  nativeTheme: { themeSource: 'system' },
}));
vi.mock('node:fs/promises', () => ({ writeFile: vi.fn() }));
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test.each(['none', 'show', 'focus'])(
  'smoke screenshots stay hidden and evidence records %s events',
  async (event) => {
    vi.useFakeTimers();
    vi.stubEnv('PITCHCREW_SMOKE_FILE', '/tmp/pitchcrew-fixture/result.json');
    const capturePage = vi.fn(async () => ({ toPNG: () => Buffer.from('fixture') }));
    let loaded: (() => Promise<void>) | undefined;
    const window = Object.assign(new EventEmitter(), {
      isVisible: () => false,
      isFocused: () => false,
      webContents: {
        once: (_event: string, listener: () => Promise<void>) => {
          loaded = listener;
        },
        executeJavaScript: vi.fn(async () => ({ appUpdatesReady: true, sheetChecks: {} })),
        capturePage,
      },
    });
    installSmokeCheck(window as unknown as BrowserWindow, { isEmpty: () => false } as NativeImage);
    if (event !== 'none') window.emit(event);
    const complete = loaded!();
    await vi.runAllTimersAsync();
    await complete;
    expect(capturePage).toHaveBeenCalledTimes(6);
    for (const args of capturePage.mock.calls)
      expect(args).toEqual([undefined, { stayHidden: true }]);
    const evidence = vi
      .mocked(writeFile)
      .mock.calls.find(([path]) => path === process.env.PITCHCREW_SMOKE_FILE);
    expect(JSON.parse(evidence![1] as string).windowStayedHidden).toBe(event === 'none');
  },
);
