import { spawn } from 'node:child_process';
import {
  currentPlatform,
  currentServiceSpec,
  nodeServiceHost,
} from '../packages/orchestrator/src/background/host.ts';
import { createBackgroundService } from '../packages/orchestrator/src/background/index.ts';
import { prepareDaemon, stopsOnExit } from '../packages/orchestrator/src/background/launcher.ts';
import { probeDaemon } from '../packages/orchestrator/src/background/lock.ts';
import { resolveDaemonSettings } from '../packages/orchestrator/src/background/settings.ts';

let daemon;
const stop = () => {
  daemon?.kill();
  process.exit(0);
};
process.on('disconnect', stop);
process.on('message', (message) => {
  if (message === 'stop') stop();
});
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
try {
  const settings = resolveDaemonSettings(process.env);
  const spec = currentServiceSpec(settings);
  const service = spec && createBackgroundService(spec, nodeServiceHost);
  const { plan, child } = await prepareDaemon({
    attempts: 240,
    settings,
    platform: currentPlatform(),
    health: () => probeDaemon(settings.port),
    serviceStatus: async () => (service ? service.status() : null),
    startService: async () => service?.start(),
    spawnDaemon: () => {
      daemon = spawn(process.execPath, ['--import', 'tsx', 'packages/orchestrator/src/cli.ts'], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
        windowsHide: true,
      });
      daemon.on('error', (error) => {
        console.error(error);
        process.exit(1);
      });
      return daemon;
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: console.log,
  });
  daemon = stopsOnExit(plan) ? child : null;
  process.send?.({ url: `http://127.0.0.1:${settings.port}` });
} catch (error) {
  console.error(error);
  daemon?.kill();
  process.exit(1);
}
