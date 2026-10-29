import {
  checkNativeBrowserFunctionality,
  type NativeFixture,
} from './fixtures/native-browser-functional.ts';
/** Isolated, hidden actual Electron + daemon-driver integration. No live sites or provider calls. */
import { build } from 'tsdown';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, rename, writeFile as writeContents } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { checkNativeBrowserTabs } from './fixtures/native-browser-tabs.ts';
import { Board } from '../../board/src/index.ts';
import { ComputerManager } from '../../mcp/src/computer.ts';
import { electronExecutable } from '../../../scripts/electron-path.ts';
import type { DesktopBrowserHost } from '../../core/src/native-browser.ts';

const formsOnly = process.argv.includes('--forms-only');
const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-native-browser-'));
const hostFile = join(directory, 'host.json');
const commands = join(directory, 'command.json');
const resultFile = join(directory, 'result.json');
const writeFile = async (path: string, data: string | Uint8Array) => {
  if (path !== commands) return writeContents(path, data);
  const pending = commands + '.pending';
  await writeContents(pending, data);
  await rename(pending, commands);
};

await build({
  entry: { main: resolve('packages/desktop/test/fixtures/native-browser-main.ts') },
  outDir: directory,
  format: 'esm',
  dts: false,
  deps: { neverBundle: ['electron'] },
});
await build({
  entry: {
    preload: resolve('packages/desktop/src/preload.ts'),
    'browser-floating-preload': resolve('packages/desktop/src/browser-floating-preload.ts'),
  },
  outDir: directory,
  format: 'cjs',
  clean: false,
  dts: false,
  deps: { neverBundle: ['electron'] },
});
await build({
  entry: { renderer: resolve('packages/desktop/test/fixtures/native-browser-renderer.ts') },
  outDir: directory,
  format: 'iife',
  platform: 'browser',
  clean: false,
  dts: false,
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
  stdio: ['ignore', 'ignore', 'inherit'],
  windowsHide: true,
});
const wait = async <T>(read: () => Promise<T | undefined>): Promise<T> => {
  const until = performance.now() + 15000;
  while (performance.now() < until) {
    const result = await read();
    if (result !== undefined) return result;
    if (child.exitCode !== null)
      throw new Error(`Native fixture exited with code ${child.exitCode}.`);
    await delay(30);
  }
  throw new Error('Native browser fixture timed out.');
};
const fixture: NativeFixture = async (command) => {
  const nonce = `${command.kind}-${Date.now()}-${Math.random()}`;
  await writeFile(commands, JSON.stringify({ ...command, nonce }));
  return wait(async () => {
    try {
      const result = JSON.parse(await readFile(resultFile, 'utf8')) as {
        nonce: string;
        value: unknown;
        error?: string;
      };
      return result.nonce === nonce ? { value: result.value, error: result.error } : undefined;
    } catch {
      return undefined;
    }
  }).then((result) => {
    if (result.error)
      throw new Error(
        `Native fixture ${command.kind} ${command.operation ?? command.expression?.slice(0, 300) ?? ''} failed: ${result.error}`,
      );
    return result.value as never;
  });
};

const board = new Board(join(directory, 'board.db'));
const manager = new ComputerManager(board, directory);
let renewal: ReturnType<typeof setInterval> | undefined;
let cleanupPassed = false;
let cleanupState = { closed: false, forced: false, exitCode: null as number | null };
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
  const tabsDriver = await manager.desktopHosts.launch(join(directory, 'tabs-profile'));
  try {
    await checkNativeBrowserTabs(tabsDriver);
  } finally {
    await tabsDriver.close();
  }
  const scope = { runId: 'native-fixture-run', roleId: 'writer', cardId: null };
  manager.bindBrowser({ ...scope, threadId: 'native-fixture' });
  const page = await wait(async () => {
    const next = await manager.inspect(scope.runId);
    return next.text.includes('Continue') ? next : undefined;
  });
  if (!manager.browsers.list()[0].native)
    throw new Error('The browser did not use the desktop host.');
  await writeFile(commands, JSON.stringify({ kind: 'narrow', nonce: 'narrow' }));
  await wait(async () => {
    try {
      const value = JSON.parse(await readFile(resultFile, 'utf8')) as { nonce?: string };
      return value.nonce === 'narrow' ? true : undefined;
    } catch {
      return undefined;
    }
  });
  if (!(await manager.inspect(scope.runId)).screenshot.length)
    throw new Error(
      'Background guest capture failed when the app window was narrower than its viewport.',
    );
  await writeFile(commands, JSON.stringify({ kind: 'wide', nonce: 'wide' }));
  await wait(async () => {
    try {
      const value = JSON.parse(await readFile(resultFile, 'utf8')) as { nonce?: string };
      return value.nonce === 'wide' ? true : undefined;
    } catch {
      return undefined;
    }
  });
  const approval = await manager.request(
    scope,
    { kind: 'click', selector: '#go' },
    'Continue fictional form',
  );
  manager.decide(approval.id, true);
  await manager.execute(scope.runId, approval.id, new AbortController().signal, () => {}, 0);
  if (!(await manager.inspect(scope.runId)).text.includes('Clicked by agent'))
    throw new Error('Agent click did not reach the native page.');
  const key = manager.browsers.key('writer', 'native-fixture', null);
  const driver = await manager.browsers.driver(key);
  const native = await driver.nativeState!();
  for (const action of [
    { kind: 'hover', selector: '#go' },
    { kind: 'scroll', selector: '#scroller', deltaX: 0, deltaY: 300 },
  ] as const) {
    const next = await manager.request(scope, action, 'Inspect fictional application controls');
    manager.decide(next.id, true);
    await manager.execute(scope.runId, next.id, new AbortController().signal, () => {}, 0);
  }
  const explored = await fixture<{ hovered: boolean; scrollTop: number }>({
    kind: 'fixture',
    id: native.id,
    expression: `({hovered:document.querySelector('#go').dataset.hovered==='true',scrollTop:document.querySelector('#scroller').scrollTop})`,
  });
  if (!explored.hovered || explored.scrollTop <= 0)
    throw new Error(
      `Native hover/scroll did not affect their inspected controls: ${JSON.stringify(explored)}`,
    );
  const lease = manager.takeControl(key);
  await manager.syncNativeControl(key, lease);
  await writeFile(commands, JSON.stringify({ kind: 'human', id: native.id, nonce: 'human' }));
  const human = await wait(async () => {
    try {
      const value = JSON.parse(await readFile(resultFile, 'utf8')) as {
        nonce: string;
        value: string;
        hidden: boolean;
        guestCount: number;
        contentsId: number;
        displayedContentsId: number;
      };
      return value.nonce === 'human' ? value : undefined;
    } catch {
      return undefined;
    }
  });
  if (
    human.value !== 'Human' ||
    !human.hidden ||
    human.guestCount !== 1 ||
    human.contentsId !== human.displayedContentsId
  )
    throw new Error(`Native human interaction failed: ${JSON.stringify(human)}`);
  let paused = false;
  try {
    await manager.inspect(scope.runId);
  } catch {
    paused = true;
  }
  if (!paused) throw new Error('Agent inspection was not paused during private control.');
  const zoomed = await driver.nativeCommand!({ kind: 'zoom', factor: 1.25 });
  if (zoomed.tabs.find((tab) => tab.id === zoomed.activeTab)?.zoomFactor !== 1.25)
    throw new Error('Native page zoom was not applied.');
  await driver.nativeCommand!({ kind: 'zoom', factor: 1 });
  await driver.nativeCommand!({ kind: 'clear-cache' });
  // DOM guest JS dialogs activate the real embedder, even with inspector handling.
  // Headless-driver, native CDP and UI suites cover dialog decisions; this fixture
  // keeps its no-OS-window invariant while testing real DOM composition and input.
  await writeFile(commands, JSON.stringify({ kind: 'popup', id: native.id, nonce: 'popup' }));
  const popup = await wait(async () => {
    try {
      const value = JSON.parse(await readFile(resultFile, 'utf8')) as {
        nonce: string;
        opener: boolean;
        windows: number;
        hidden: boolean;
        owned: boolean;
        isolated: boolean;
      };
      return value.nonce === 'popup' ? value : undefined;
    } catch {
      return undefined;
    }
  });
  if (!popup.opener || popup.windows !== 2 || !popup.hidden || !popup.owned || !popup.isolated)
    throw new Error(
      `Native popup lost its opener, ownership or hidden-window behavior: ${JSON.stringify(popup)}`,
    );
  await wait(async () => {
    const state = await driver.nativeState!();
    return state.tabs.length >= 2 ? state : undefined;
  });
  const tabs = await driver.nativeCommand!({ kind: 'new-tab' });
  if (tabs.tabs.length !== 3) throw new Error('New browser tab was not created.');
  await driver.nativeCommand!({ kind: 'select-tab', tabId: native.activeTab });
  await manager.resizeBrowser(key, { width: 700, height: 500 }, lease);
  await manager.returnControl(key, lease);
  const resumed = await manager.inspect(scope.runId);
  if (!resumed.text.includes('Human') || resumed.text.includes('fictional-password'))
    throw new Error('Native inspection or credential redaction failed.');
  await writeFile(join(directory, 'masked.jpeg'), Buffer.from(resumed.screenshot, 'base64'));
  await writeFile(
    commands,
    JSON.stringify({ kind: 'mask-check', id: native.id, nonce: 'mask-check' }),
  );
  const mask = await wait(async () => {
    try {
      const value = JSON.parse(await readFile(resultFile, 'utf8')) as {
        nonce: string;
        masked: boolean;
      };
      return value.nonce === 'mask-check' ? value : undefined;
    } catch {
      return undefined;
    }
  });
  if (!mask.masked)
    throw new Error(
      `Native screenshot did not preserve the credential mask: ${JSON.stringify(mask)}`,
    );
  await driver.validateApplicationValues?.([], { kind: 'click', selector: '#go' });
  const agentTabs = await manager.tabs(scope.runId, { kind: 'open' });
  if (agentTabs.tabs.length !== 4) throw new Error('Agent tab opening failed.');
  await manager.tabs(scope.runId, { kind: 'select', tabId: native.activeTab });
  const pinned = await manager.request(
    scope,
    { kind: 'hover', selector: '#go', tabId: native.activeTab },
    'Inspect exact native tab',
  );
  if (pinned.action.tabId !== native.activeTab)
    throw new Error('Agent approval did not bind its native tab.');
  manager.decide(pinned.id, true);
  await manager.execute(scope.runId, pinned.id, new AbortController().signal, () => {}, 0);
  await writeFile(commands, JSON.stringify({ kind: 'profiles', id: native.id, nonce: 'profiles' }));
  const profile = await wait(async () => {
    try {
      const value = JSON.parse(await readFile(resultFile, 'utf8')) as {
        nonce: string;
        profileId: string;
        cookieStored: boolean;
      };
      return value.nonce === 'profiles' ? value : undefined;
    } catch {
      return undefined;
    }
  });
  if (!profile.cookieStored)
    throw new Error('Native cookie import did not retain the reviewed session.');
  await manager.openBrowser('writer', 'profile-fixture', null);
  const namedDriver = await manager.browsers.driver(
    manager.browsers.key('writer', 'profile-fixture', null),
  );
  const namedState = await namedDriver.nativeState!();
  if (namedState.profile?.id !== profile.profileId || namedState.profile.name !== 'Work fixture')
    throw new Error('New browser session did not use the selected named profile.');
  if ((await driver.nativeState!()).profile?.id !== 'default')
    throw new Error('Existing browser session changed its sign-in profile.');
  await writeFile(
    commands,
    JSON.stringify({
      kind: 'presentation',
      id: namedState.id,
      otherId: native.id,
      nonce: 'presentation',
    }),
  );
  const presentation = await wait(async () => {
    try {
      const value = JSON.parse(await readFile(resultFile, 'utf8')) as {
        nonce: string;
        liveOverlays: boolean;
      };
      return value.nonce === 'presentation' ? value : undefined;
    } catch {
      return undefined;
    }
  });
  if (!presentation.liveOverlays)
    throw new Error(`Native session presentation flickered: ${JSON.stringify(presentation)}`);
  let functionalTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      checkNativeBrowserFunctionality(manager, board, directory, fixture, formsOnly),
      new Promise<never>((_resolve, reject) => {
        functionalTimeout = setTimeout(
          () =>
            reject(new Error('Native functional workflows exceeded their three-minute deadline.')),
          180000,
        );
      }),
    ]);
  } finally {
    clearTimeout(functionalTimeout);
  }

  if (page.screenshot.length === 0 || resumed.screenshot.length === 0)
    throw new Error('Agent screenshots were unavailable.');
} catch (error) {
  console.error(error);
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
  cleanupPassed = closed && !forced && child.exitCode === 0;
  cleanupState = { closed, forced, exitCode: child.exitCode };
}
if (!cleanupPassed)
  throw new Error(
    `Native browser resource cleanup did not complete: ${JSON.stringify(cleanupState)}`,
  );
console.log(
  formsOnly
    ? 'Native browser form workflows passed through the real approval gate and DOM guests; windows stayed hidden and resources closed.'
    : 'Native browser smoke passed: same DOM guest for human and agent, live page under app overlays, isolated popup opener, tabs, private takeover, redacted inspection and owned resource cleanup; windows stayed hidden.',
);
