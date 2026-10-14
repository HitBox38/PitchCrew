import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { electronExecutable } from '../electron-path.ts';
import { waitForSmokeExit } from '../desktop-smoke-exit.ts';

// This deliberately imports no Pitchcrew runtime, UI, preload, updater or daemon.
const source = `
const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
const { performance } = require('node:perf_hooks');
let requestedAt, started, window;
const events = {};
let shown = false, focused = false;
const record = (phase) => {
  if (requestedAt === undefined) return;
  events[phase] = performance.now() - started;
  writeFileSync(process.env.PITCHCREW_SMOKE_FILE + '.shutdown.json', JSON.stringify({
    requestedAt, events, windowStayedHidden: !shown && !focused,
  }));
};
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.setPath('userData', process.env.PROBE_HOME);
app.on('will-quit', () => record('willQuit'));
app.on('quit', () => record('quit'));
app.whenReady().then(async () => {
  if (process.env.PROBE_WINDOW === '1') {
    window = new BrowserWindow({ show: false, focusable: false, skipTaskbar: true });
    window.on('show', () => { shown = true; });
    window.on('focus', () => { focused = true; });
    window.on('close', () => record('windowClose'));
    window.on('closed', () => record('windowClosed'));
    await window.loadURL('about:blank');
  }
  requestedAt = Date.now();
  started = performance.now();
  record('requested');
  app.quit();
});
`;
const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-native-shutdown-'));
const dist = join(root, 'packages/desktop/dist');
await mkdir(dist, { recursive: true });
const entry = join(dist, `${basename(directory)}.cjs`);
// Parse generated CommonJS before launching Electron; syntax errors must never open a native dialog.
new Script(source, { filename: entry });
await writeFile(entry, source);
const results = [];
try {
  for (const mode of ['no-window', 'hidden-window']) {
    const home = join(directory, mode);
    await mkdir(home);
    const evidence = join(home, 'result.json');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PROBE_HOME: home,
      PROBE_WINDOW: mode === 'hidden-window' ? '1' : '0',
      PITCHCREW_SMOKE_FILE: evidence,
    };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(electronExecutable, [entry], { env, windowsHide: true, stdio: 'ignore' });
    const started = performance.now();
    try {
      const exit = await waitForSmokeExit(child, evidence, { timeoutMs: 30_000 });
      results.push({ mode, passed: true, elapsedMs: performance.now() - started, ...exit });
    } catch (error) {
      results.push({
        mode,
        passed: false,
        elapsedMs: performance.now() - started,
        error: String(error),
      });
    }
    await readFile(`${evidence}.shutdown.json`, 'utf8').then((value) => {
      if (!JSON.parse(value).windowStayedHidden)
        throw new Error('Native probe showed or focused a window.');
    });
  }
  const report = { platform: process.platform, arch: process.arch, directory, results };
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (results.some((result) => !result.passed)) process.exitCode = 1;
} finally {
  await rm(entry, { force: true });
}
