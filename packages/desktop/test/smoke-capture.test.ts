import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserWindow, NativeImage } from 'electron';
import { afterEach, expect, test, vi } from 'vitest';
import { installSmokeCheck } from '../src/smoke.ts';
import { smokeStreamPartials, smokeStreamPrefix } from '../src/smoke-stream.ts';

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

test('only acknowledges known streaming checkpoints in the isolated smoke folder', async () => {
  vi.stubEnv('PITCHCREW_SMOKE_FILE', '/tmp/pitchcrew-fixture/result.json');
  vi.mocked(writeFile).mockResolvedValue();
  const webContents = new EventEmitter();
  const window = Object.assign(new EventEmitter(), {
    isVisible: () => false,
    isFocused: () => false,
    webContents,
  });
  installSmokeCheck(window as unknown as BrowserWindow, {} as NativeImage);
  for (const message of ['Unrelated console message', `${smokeStreamPrefix}unknown checkpoint`])
    webContents.emit('console-message', { message });
  expect(writeFile).not.toHaveBeenCalled();
  webContents.emit('console-message', { message: smokeStreamPrefix + smokeStreamPartials[0] });
  expect(writeFile).toHaveBeenCalledWith(
    join('/tmp/pitchcrew-fixture', 'stream-ack.txt'),
    smokeStreamPartials[0],
  );
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
      webContents: Object.assign(new EventEmitter(), {
        once: (_event: string, listener: () => Promise<void>) => {
          loaded = listener;
        },
        executeJavaScript: vi.fn(async () => ({ appUpdatesReady: true, sheetChecks: {} })),
        capturePage,
      }),
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
