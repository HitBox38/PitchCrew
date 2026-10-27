/** Isolated, hidden actual Electron + daemon-driver integration. No live sites or provider calls. */
import { build } from 'tsdown';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Board } from '../../board/src/index.ts';
import { ComputerManager } from '../../mcp/src/computer.ts';
import { electronExecutable } from '../../../scripts/electron-path.ts';
import type { DesktopBrowserHost } from '../../core/src/native-browser.ts';

const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-native-browser-'));
const hostFile = join(directory, 'host.json');
const commands = join(directory, 'command.json');
const resultFile = join(directory, 'result.json');
await build({
  entry: { main: resolve('packages/desktop/test/fixtures/native-browser-main.ts') },
  outDir: directory,
  format: 'esm',
  dts: false,
  deps: { neverBundle: ['electron'] },
});
const env: NodeJS.ProcessEnv = {
  ...process.env,
  PITCHCREW_NATIVE_SMOKE_HOME: join(directory, 'desktop'),
  PITCHCREW_NATIVE_SMOKE_HOST: hostFile,
  PITCHCREW_NATIVE_SMOKE_COMMAND: commands,
  PITCHCREW_NATIVE_SMOKE_RESULT: resultFile,
};
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electronExecutable, [join(directory, 'main.mjs')], {
  env,
  stdio: ['ignore', 'ignore', 'pipe'],
  windowsHide: true,
});
let errorOutput = '';
child.stderr?.on('data', (data) => {
  if (errorOutput.length < 20000) errorOutput += String(data);
});
const wait = async <T>(read: () => Promise<T | undefined>): Promise<T> => {
  const until = performance.now() + 15000;
  while (performance.now() < until) {
    const result = await read();
    if (result !== undefined) return result;
    if (child.exitCode !== null) throw new Error(`Native fixture exited: ${errorOutput}`);
    await delay(30);
  }
  throw new Error(`Native browser fixture timed out: ${errorOutput}`);
};
const board = new Board(join(directory, 'board.db'));
const manager = new ComputerManager(board, directory);
let renewal: ReturnType<typeof setInterval> | undefined;
let cleanupPassed = false;
try {
  const descriptor = await wait(async () => {
    try {
      return JSON.parse(await readFile(hostFile, 'utf8')) as DesktopBrowserHost;
    } catch {
      return undefined;
    }
  });
  manager.desktopHosts.register(descriptor);
  renewal = setInterval(() => manager.desktopHosts.register(descriptor), 5000);
  const scope = { runId: 'native-fixture-run', roleId: 'writer', cardId: null };
  manager.bindBrowser({ ...scope, threadId: 'native-fixture' });
  const page = await wait(async () => {
    const next = await manager.inspect(scope.runId);
    return next.text.includes('Continue') ? next : undefined;
  });
  if (!manager.browsers.list()[0].native)
    throw new Error('The browser did not use the desktop host.');
  const approval = await manager.request(
    scope,
    { kind: 'click', selector: '#go' },
    'Continue fictional form',
  );
  manager.decide(approval.id, true);
  await manager.execute(scope.runId, approval.id, new AbortController().signal, () => {}, 0);
  if (!(await manager.inspect(scope.runId)).text.includes('Clicked by agent'))
    throw new Error('Agent click did not reach the native page.');
  for (const action of [
    { kind: 'hover', selector: '#go' },
    { kind: 'scroll', selector: '#scroller', deltaX: 0, deltaY: 300 },
  ] as const) {
    const next = await manager.request(scope, action, 'Inspect fictional application controls');
    manager.decide(next.id, true);
    await manager.execute(scope.runId, next.id, new AbortController().signal, () => {}, 0);
  }
  const key = manager.browsers.key('writer', 'native-fixture', null);
  const lease = manager.takeControl(key);
  await manager.syncNativeControl(key, lease);
  const driver = await manager.browsers.driver(key);
  const native = await driver.nativeState!();
  await writeFile(commands, JSON.stringify({ kind: 'human', id: native.id, nonce: 'human' }));
  const human = await wait(async () => {
    try {
      return JSON.parse(await readFile(resultFile, 'utf8')) as {
        value: string;
        hidden: boolean;
        nativeViews: number;
      };
    } catch {
      return undefined;
    }
  });
  if (human.value !== 'Human' || !human.hidden || human.nativeViews !== 1)
    throw new Error(`Native human interaction failed: ${JSON.stringify(human)}`);
  let paused = false;
  try {
    await manager.inspect(scope.runId);
  } catch {
    paused = true;
  }
  if (!paused) throw new Error('Agent inspection was not paused during private control.');
  await writeFile(commands, JSON.stringify({ kind: 'dialog', id: native.id, nonce: 'dialog' }));
  await wait(async () => {
    const next = await driver.nativeState!();
    return next.dialog?.message === 'Fictional native dialog' ? next : undefined;
  });
  await manager.manualInput(key, lease, { kind: 'dialog', decision: 'dismiss' });
  await writeFile(commands, JSON.stringify({ kind: 'popup', id: native.id, nonce: 'popup' }));
  const popup = await wait(async () => {
    try {
      const value = JSON.parse(await readFile(resultFile, 'utf8')) as {
        nonce: string;
        opener: boolean;
        windows: number;
      };
      return value.nonce === 'popup' ? value : undefined;
    } catch {
      return undefined;
    }
  });
  if (!popup.opener || popup.windows !== 1)
    throw new Error('Native popup lost its opener or created an application window.');
  await wait(async () => {
    const state = await driver.nativeState!();
    return state.tabs.length >= 2 ? state : undefined;
  });
  const tabs = await driver.nativeCommand!({ kind: 'new-tab' });
  if (tabs.tabs.length !== 3) throw new Error('New browser tab was not created.');
  await driver.nativeCommand!({ kind: 'select-tab', tabId: native.activeTab });
  await manager.returnControl(key, lease);
  const resumed = await manager.inspect(scope.runId);
  if (!resumed.text.includes('Human') || resumed.text.includes('fictional-password'))
    throw new Error('Native inspection or credential redaction failed.');
  await driver.validateApplicationValues?.([], { kind: 'click', selector: '#go' });
  if (page.screenshot.length === 0 || resumed.screenshot.length === 0)
    throw new Error('Agent screenshots were unavailable.');
} catch (error) {
  console.error(error);
  console.error(errorOutput);
  throw error;
} finally {
  clearInterval(renewal);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const closed = await Promise.race([
    manager.close().then(
      () => true,
      () => false,
    ),
    new Promise<false>((resolve) => {
      closeTimer = setTimeout(() => resolve(false), 5000);
    }),
  ]);
  clearTimeout(closeTimer);
  let forced = false;
  await writeFile(commands, JSON.stringify({ kind: 'quit', nonce: 'quit' }));
  if (child.exitCode === null)
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        forced = true;
        child.kill('SIGKILL');
        resolve();
      }, 5000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  board.close();
  await rm(directory, { recursive: true, force: true });
  cleanupPassed = closed && !forced;
}
if (!cleanupPassed) throw new Error('Native browser cleanup did not complete gracefully.');
console.log(
  'Native browser smoke passed: real native view, human typing, gated agent actions, tabs/popups, private takeover, redacted inspection and graceful shutdown; window stayed hidden.',
);
