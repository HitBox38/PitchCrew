import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import electron from 'electron';
const root = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--production');
const port = process.env.PITCHCREW_PORT ?? '4417';
const url = `http://127.0.0.1:${port}`;
let daemon;
async function alive() {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) });
    const data = await response.json();
    return data.app === 'pitchcrew';
  } catch {
    return false;
  }
}
if (!(await alive())) {
  daemon = spawn(
    process.execPath,
    ['--import', 'tsx', 'packages/orchestrator/src/cli.ts', ...(!production ? ['--dev'] : [])],
    { cwd: root, stdio: 'inherit', windowsHide: true },
  );
  let ready = false;
  // First startup may spend up to 30 seconds loading starter skills, then detect runtimes.
  for (let i = 0; i < 90; i++) {
    if (await alive()) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) {
    daemon.kill();
    throw new Error('The local daemon did not become ready.');
  }
}
const desktopEnv = { ...process.env, PITCHCREW_URL: url };
delete desktopEnv.ELECTRON_RUN_AS_NODE;
const desktop = spawn(electron, [resolve(root, 'packages/desktop/dist/main.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: desktopEnv,
  windowsHide: true,
});
const cleanup = () => {
  desktop.kill();
  daemon?.kill();
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
desktop.on('error', (error) => {
  console.error(error);
  cleanup();
  process.exitCode = 1;
});
desktop.on('exit', (code) => {
  daemon?.kill();
  process.exitCode = code ?? 0;
});
