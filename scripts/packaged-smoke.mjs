import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';

const output = resolve('dist/releases');
const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-packaged-check-'));
const evidence = join(directory, 'result.json');
const portProbe = createServer();
await new Promise((resolve) => portProbe.listen(0, '127.0.0.1', resolve));
const { port } = portProbe.address();
await new Promise((resolve) => portProbe.close(resolve));
let executable;
if (process.platform === 'win32') executable = join(output, 'win-unpacked/Pitchcrew.exe');
else if (process.platform === 'darwin') {
  const folders = await readdir(output);
  const folder = folders.find((name) => name === 'mac-arm64' || name === 'mac');
  if (!folder) throw new Error('Packaged macOS app not found.');
  executable = join(output, folder, 'Pitchcrew.app/Contents/MacOS/Pitchcrew');
} else executable = join(output, 'linux-unpacked/pitchcrew');
const resources =
  process.platform === 'darwin'
    ? resolve(dirname(executable), '../Resources')
    : join(dirname(executable), 'resources');
const runtime = join(resources, 'runtime');
execFileSync(
  join(runtime, 'node', process.platform === 'win32' ? 'node.exe' : 'node'),
  [
    '--input-type=module',
    '--eval',
    "import { chromium } from 'playwright'; const browser = await chromium.launch({ headless: true, channel: 'chromium' }); const page = await browser.newPage(); await page.setContent('<title>Packaged browser</title>'); if (await page.title() !== 'Packaged browser') throw new Error('Browser check failed'); await browser.close();",
  ],
  {
    cwd: runtime,
    stdio: 'inherit',
    timeout: 30000,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(runtime, 'browsers') },
  },
);
const env = {
  ...process.env,
  PITCHCREW_HOME: join(directory, 'workspace'),
  PITCHCREW_PORT: String(port),
  PITCHCREW_SEED_SKILLS: '0',
  PITCHCREW_UPDATE_CHECKS: '0',
  PITCHCREW_SMOKE_FILE: evidence,
  PITCHCREW_SMOKE_CHAT: '0',
};
delete env.PITCHCREW_URL;
delete env.ELECTRON_RUN_AS_NODE;
// Xvfb has no hardware GPU; use software rendering for reliable screenshot capture.
const args = process.platform === 'linux' ? ['--disable-gpu'] : [];
const desktop = spawn(executable, args, { env, stdio: 'inherit', windowsHide: true });
const timer = setTimeout(() => desktop.kill(), 300000);
try {
  const code = await new Promise((resolve, reject) => {
    desktop.once('error', reject);
    desktop.once('exit', resolve);
  });
  if (code !== 0) throw new Error(`Packaged app exited with ${code}.`);
  const result = JSON.parse(await readFile(evidence, 'utf8'));
  if (
    result.apiStatus !== 200 ||
    result.roles !== 7 ||
    !result.uiReady ||
    !result.iconLoaded ||
    result.requireType !== 'undefined' ||
    !result.sandbox ||
    !result.contextIsolation
  )
    throw new Error('Packaged app failed the renderer/daemon check.');
  let stopped = false;
  for (let i = 0; i < 20; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(500) });
    } catch {
      stopped = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!stopped) throw new Error('The packaged app left its daemon running after exit.');
  console.log('Packaged app started its daemon, rendered the UI and stopped its owned daemon.');
} finally {
  clearTimeout(timer);
  desktop.kill();
}
