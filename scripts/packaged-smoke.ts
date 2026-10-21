import { defaultRoleIds } from '../packages/core/src/states.ts';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { waitForSmokeExit } from './desktop-smoke-exit.ts';

const output = resolve('dist/releases');
const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-packaged-check-'));
const evidence = join(directory, 'result.json');
const portProbe = createServer();
await new Promise<void>((resolve) => portProbe.listen(0, '127.0.0.1', () => resolve()));
const address = portProbe.address();
if (!address || typeof address === 'string') throw new Error('No smoke-test port assigned.');
const { port } = address;
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
const env: NodeJS.ProcessEnv = {
  ...process.env,
  PITCHCREW_POSTHOG_DISABLED: '1',
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
try {
  const exit = await waitForSmokeExit(desktop, evidence, { timeoutMs: 300_000 });
  const result = JSON.parse(await readFile(evidence, 'utf8'));
  if (process.env.PITCHCREW_SMOKE_VISIBLE !== '1' && !result.windowStayedHidden)
    throw new Error('Packaged smoke check showed or focused its window.');
  if (
    result.apiStatus !== 200 ||
    result.roles !== defaultRoleIds.length ||
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
  console.log(JSON.stringify(exit));
} finally {
  desktop.kill();
}
