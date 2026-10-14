import { EventEmitter } from 'node:events';
import { writeFileSync } from 'node:fs';
import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import { afterEach, expect, test, vi } from 'vitest';
import { installSmokeShutdownCheck } from '../src/smoke-shutdown.ts';

vi.mock('electron', () => ({ app: Object.assign(new EventEmitter(), { quit: vi.fn() }) }));
vi.mock('node:fs', () => ({ writeFileSync: vi.fn() }));
afterEach(() => {
  app.removeAllListeners();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

test('records lifecycle evidence without treating quit as process exit or suppressing unload', () => {
  const window = new EventEmitter();
  const quit = installSmokeShutdownCheck(window as BrowserWindow, '/tmp/fixture/result.json');
  window.emit('close');
  expect(writeFileSync).not.toHaveBeenCalled();
  quit();
  expect(app.quit).toHaveBeenCalledOnce();
  for (const event of ['close', 'closed']) window.emit(event);
  app.emit('will-quit', {
    preventDefault: () => {
      throw new Error('Do not bypass unload');
    },
  });
  app.emit('quit');
  const [file, content] = vi.mocked(writeFileSync).mock.calls.at(-1)!;
  expect(file).toBe('/tmp/fixture/result.json.shutdown.json');
  const evidence = JSON.parse(content as string);
  expect(Object.keys(evidence.events)).toEqual([
    'requested',
    'windowClose',
    'windowClosed',
    'willQuit',
    'quit',
  ]);
  expect(evidence).not.toHaveProperty('exited');
});

test('an evidence write failure never becomes a native uncaught-error dialog', () => {
  const error = new Error('Fixture disk failure');
  vi.mocked(writeFileSync).mockImplementationOnce(() => {
    throw error;
  });
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const quit = installSmokeShutdownCheck(
    new EventEmitter() as BrowserWindow,
    '/tmp/fixture/result.json',
  );
  quit();
  expect(logged).toHaveBeenCalledWith('Could not write native smoke shutdown evidence:', error);
  expect(app.quit).toHaveBeenCalledOnce();
});
