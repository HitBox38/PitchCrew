import { _electron, type ElectronApplication, type Page } from 'playwright';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { electronExecutable } from '../../../../scripts/electron-path.ts';
import { installSite } from './site.ts';

export const until = async <T>(
  read: () => Promise<T>,
  message: string,
  timeout = 15000,
): Promise<NonNullable<T>> => {
  const end = Date.now() + timeout;
  let last: unknown;
  while (Date.now() < end) {
    try {
      const result = await read();
      if (result) return result as NonNullable<T>;
    } catch (error) {
      last = error;
    }
    await delay(50);
  }
  throw new Error(`${message}${last ? `: ${String(last)}` : ''}`);
};
const freePort = async () => {
  const server = createServer();
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((ready) => server.close(() => ready()));
  return port;
};
const waitExit = async (child: ChildProcess, label: string, tree = false) => {
  if (child.exitCode === null && child.signalCode === null) {
    try {
      await until(
        async () => child.exitCode !== null || child.signalCode !== null,
        `${label} did not exit normally`,
        10000,
      );
    } catch (error) {
      // Playwright launches a private process group on POSIX. A failed test
      // must also reap helpers which inherited its stderr pipe.
      if (!tree) child.kill('SIGKILL');
      else if (child.pid) {
        if (process.platform === 'win32')
          spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
        else process.kill(-child.pid, 'SIGKILL');
      }
      throw error;
    }
  }
  assert.equal(child.exitCode, 0, `${label} exited unsuccessfully`);
};

export const startDesktop = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-e2e-'));
  const port = await freePort();
  let log = '';
  const daemon = spawn(
    'bun',
    ['--no-env-file', '--no-install', 'packages/orchestrator/test/fixtures/browser-e2e-daemon.ts'],
    {
      env: {
        ...process.env,
        PITCHCREW_HOME: directory,
        PITCHCREW_PORT: String(port),
        PITCHCREW_POSTHOG_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  for (const stream of [daemon.stdout, daemon.stderr])
    stream?.on('data', (chunk) => {
      log = (log + String(chunk)).slice(-64000);
    });
  let electron: ElectronApplication | undefined;
  let page: Page | undefined;
  const errors: string[] = [];
  let closing: Promise<void> | undefined;
  const cleanup = async () => {
    const failures: unknown[] = [];
    const attempt = async (operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch (error) {
        failures.push(error);
      }
    };
    if (electron) {
      const app = electron;
      await attempt(async () => {
        if (page && !page.isClosed()) {
          await writeFile(join(directory, 'renderer.html'), await page.content());
          await writeFile(join(directory, 'renderer-errors.json'), JSON.stringify(errors));
          const image = await app.evaluate(async ({ BrowserWindow }) =>
            (
              await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, {
                stayHidden: true,
                stayAwake: true,
              })
            )
              .toPNG()
              .toString('base64'),
          );
          await writeFile(join(directory, 'desktop.png'), Buffer.from(image, 'base64'));
        }
        await app.context().tracing.stop({ path: join(directory, 'trace.zip') });
        const visibility = await app.evaluate(({ BrowserWindow }) => ({
          current: BrowserWindow.getAllWindows().every(
            (window) => !window.isVisible() && !window.isFocused(),
          ),
          violations: (globalThis as unknown as { browserE2EVisibility: string[] })
            .browserE2EVisibility,
        }));
        assert.equal(visibility.current, true, 'E2E showed or focused a desktop window');
        assert.deepEqual(
          visibility.violations,
          [],
          'E2E showed or focused a window during a workflow',
        );
      });
      await attempt(async () => {
        // Normal close also releases Playwright's Node inspector. It does not
        // bypass app quit or its guest cleanup; actual process exit is separate.
        const closed = app.close().then(
          () => undefined,
          (error) => error as Error,
        );
        await waitExit(app.process(), 'Electron', true);
        const error = await closed;
        if (error) throw error;
      });
    }
    daemon.kill('SIGTERM');
    await attempt(() => waitExit(daemon, 'Daemon'));
    await writeFile(join(directory, 'daemon.log'), log);
    if (failures.length)
      throw new AggregateError(failures, `Desktop E2E cleanup failed; evidence: ${directory}`);
  };
  const close = () => (closing ??= cleanup());

  try {
    const ready = await until(
      async () =>
        JSON.parse(await readFile(join(directory, 'ready.json'), 'utf8')) as { url: string },
      `Daemon did not start (${directory})`,
    );
    await mkdir(join(directory, 'desktop'));
    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ),
      PITCHCREW_URL: ready.url,
      PITCHCREW_E2E_FILE: join(directory, 'desktop', 'result.json'),
      PITCHCREW_POSTHOG_DISABLED: '1',
      PITCHCREW_SMOKE_VISIBLE: '0',
    };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.PITCHCREW_SMOKE_FILE;
    electron = await _electron.launch({
      executablePath: electronExecutable,
      args: [resolve('packages/desktop/dist/main.mjs')],
      env,
      timeout: 30000,
    });
    page = await electron.firstWindow();
    await electron.context().tracing.start({ snapshots: true, sources: true });
    await electron.evaluate(({ app, BrowserWindow }) => {
      const violations: string[] = [];
      Object.assign(globalThis, { browserE2EVisibility: violations });
      for (const window of BrowserWindow.getAllWindows()) {
        if (window.isVisible() || window.isFocused()) violations.push('visible at enrollment');
        window.on('show', () => violations.push('show'));
        window.on('focus', () => violations.push('focus'));
      }
      app.on('browser-window-created', (_event, window) => {
        window.on('show', () => violations.push('show'));
        window.on('focus', () => violations.push('focus'));
      });
    });
    page.setDefaultTimeout(10000);
    await installSite(electron);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForURL((url) => url.origin === ready.url);
    await page.waitForLoadState('load');
    await page.locator('a[href="/chat/writer"]').first().waitFor({ timeout: 30000 });
    const later = page.getByRole('button', { name: 'Set up later', exact: true });
    if (await later.isVisible()) await later.click();
    await page.locator('a[href="/chat/writer"]').first().click();
    await page.locator('button[aria-controls="agent-browser-panel"]').waitFor({ timeout: 30000 });
    if (await later.isVisible()) await later.click();
    console.log(`Desktop E2E evidence: ${directory}`);
    return { electron, page, directory, errors, url: ready.url, close };
  } catch (error) {
    await close().catch((cleanup) => console.error(cleanup));
    throw new Error(`Desktop E2E startup failed (${directory}): ${String(error)}\n${log}`);
  }
};
export type DesktopE2E = Awaited<ReturnType<typeof startDesktop>>;

export const activeGuest = async ({ electron, page }: DesktopE2E) => {
  const selected = await page.evaluate(async () => {
    const view = (await window.pitchcrewBrowser!.views()).find(
      (view) => view.bounds && view.contentsId,
    );
    if (!view) return null;
    const node = document.querySelector(`webview[data-browser-view="${view.token}"]`);
    if (
      !node ||
      getComputedStyle(node).visibility !== 'visible' ||
      getComputedStyle(node).zIndex !== '1'
    )
      return null;
    return { id: view.contentsId!, token: view.token };
  });
  assert.ok(selected, 'No selected production browser guest is presented');
  const { id, token } = selected;
  return {
    id,
    token,
    read: <T>(expression: string) =>
      electron.evaluate(
        ({ webContents }, { id, expression }) =>
          webContents.fromId(id)!.executeJavaScript(expression) as Promise<T>,
        { id, expression },
      ),
  };
};
