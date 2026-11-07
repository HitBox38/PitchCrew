/** Actual hidden Electron popup dispatch; the OS-opening boundary is intercepted. */
import { build } from 'tsdown';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { electronExecutable } from '../../../scripts/electron-path.ts';

const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-runtime-signin-link-'));
const resultFile = join(directory, 'result.json');
await build({
  entry: { main: resolve('packages/desktop/test/fixtures/runtime-signin-link-main.ts') },
  outDir: directory,
  format: 'esm',
  dts: false,
  deps: { neverBundle: ['electron'] },
});
await build({
  entry: { preload: resolve('packages/desktop/test/fixtures/runtime-signin-link-preload.ts') },
  outDir: directory,
  format: 'cjs',
  clean: false,
  dts: false,
  deps: { neverBundle: ['electron'] },
});
const env: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !/KEY|TOKEN|SECRET|PASSWORD|AUTH|^PITCHCREW_|^ELECTRON_RUN_AS_NODE$/i.test(key),
  ),
);
env.PITCHCREW_SIGNIN_LINK_HOME = join(directory, 'electron');
env.PITCHCREW_SIGNIN_LINK_RESULT = resultFile;
await mkdir(env.PITCHCREW_SIGNIN_LINK_HOME, { recursive: true });
const child = spawn(electronExecutable, [join(directory, 'main.mjs')], {
  env,
  stdio: ['ignore', 'inherit', 'inherit'],
  windowsHide: true,
});
let forced = false;
const deadline = setTimeout(() => {
  forced = true;
  if (process.platform === 'win32' && child.pid)
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  else child.kill('SIGKILL');
}, 20_000);
const exitCode = await new Promise<number | null>((resolveExit, reject) => {
  child.once('error', reject);
  child.once('close', resolveExit);
}).finally(() => clearTimeout(deadline));
if (forced || exitCode !== 0)
  throw new Error(
    `Hidden Electron sign-in link fixture failed (exit ${exitCode}, forced ${forced}).`,
  );
const result = JSON.parse(await readFile(resultFile, 'utf8')) as Record<string, unknown>;
if (result.passed !== true) throw new Error('Hidden Electron link verification did not pass.');
console.log(JSON.stringify({ ...result, normalExit: true, evidence: resultFile }, null, 2));
