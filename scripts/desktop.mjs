// Run with `node --import tsx` so the launcher shares the daemon's TypeScript service logic.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import electron from 'electron';
import {
  currentPlatform,
  currentServiceSpec,
  nodeServiceHost,
} from '../packages/orchestrator/src/background/host.ts';
import { createBackgroundService } from '../packages/orchestrator/src/background/index.ts';
import { prepareDaemon, stopsOnExit } from '../packages/orchestrator/src/background/launcher.ts';
import { probeDaemon } from '../packages/orchestrator/src/background/lock.ts';
import { resolveDaemonSettings } from '../packages/orchestrator/src/background/settings.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--production');
const settings = resolveDaemonSettings(process.env);
const url = `http://127.0.0.1:${settings.port}`;
const spec = currentServiceSpec(settings);
const service = spec && createBackgroundService(spec, nodeServiceHost);
// Reuse a running daemon, start an installed background service, or spawn a daemon of our own.
// Only a daemon spawned here stops with the window; a service-owned daemon keeps running.
const { plan, child } = await prepareDaemon({
  settings,
  platform: currentPlatform(),
  health: () => probeDaemon(settings.port),
  serviceStatus: async () => (service ? service.status() : null),
  startService: async () => service?.start(),
  spawnDaemon: () =>
    spawn(
      process.execPath,
      ['--import', 'tsx', 'packages/orchestrator/src/cli.ts', ...(!production ? ['--dev'] : [])],
      { cwd: root, stdio: 'inherit', windowsHide: true },
    ),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log: (message) => console.log(message),
});
const daemon = stopsOnExit(plan) ? child : null;
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
