import { spawn, type ChildProcess } from 'node:child_process';
import {
  currentPlatform,
  currentServiceSpec,
  nodeServiceHost,
} from '../packages/orchestrator/src/background/host.ts';
import { createBackgroundService } from '../packages/orchestrator/src/background/index.ts';
import { prepareDaemon, stopsOnExit } from '../packages/orchestrator/src/background/launcher.ts';
import { probeDaemon } from '../packages/orchestrator/src/background/lock.ts';
import { resolveDaemonSettings } from '../packages/orchestrator/src/background/settings.ts';
import { createUpdateHandoff } from '../packages/orchestrator/src/background/update-handoff.ts';
import {
  markUpdateRestart,
  clearUpdateRestart,
  verifyUpdateRestart,
} from '../packages/orchestrator/src/background/update-restart.ts';
import { readAppBuild } from '../packages/orchestrator/src/app-updates/build.ts';

let daemon: ChildProcess | null | undefined;
let handoff: ReturnType<typeof createUpdateHandoff> | undefined;
let settings: ReturnType<typeof resolveDaemonSettings>;
let stopping = false;
const stop = async (graceful = false) => {
  if (stopping) return;
  stopping = true;
  const owned = daemon;
  if (graceful && owned?.connected && owned.exitCode === null) {
    const exited = new Promise((resolve) => owned.once('exit', resolve));
    owned.send('pitchcrew:stop');
    await exited;
  } else owned?.kill();
  process.exit(0);
};
process.on('disconnect', () => void stop());
process.on('message', async (message: unknown) => {
  if (message === 'stop') {
    void stop(true);
    return;
  }
  if (
    !handoff ||
    !message ||
    typeof message !== 'object' ||
    !('action' in message) ||
    (message.action !== 'prepare-update' && message.action !== 'recover-update') ||
    !('request' in message)
  )
    return;
  try {
    if (message.action === 'prepare-update') {
      await markUpdateRestart(
        settings.directory,
        'version' in message && typeof message.version === 'string' ? message.version : undefined,
      );
      await handoff.prepare();
    } else {
      await handoff.recover();
      await clearUpdateRestart(settings.directory);
    }
    process.send?.({ request: message.request, ok: true });
  } catch (error) {
    process.send?.({
      request: message.request,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
try {
  settings = resolveDaemonSettings(process.env);
  const spec = currentServiceSpec(settings);
  const service = spec && createBackgroundService(spec, nodeServiceHost);
  const spawnDaemon = () => {
    daemon = spawn(process.execPath, ['--import', 'tsx', 'packages/orchestrator/src/cli.ts'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      windowsHide: true,
    });
    daemon.on('error', (error) => {
      console.error(error);
      process.exit(1);
    });
    return daemon;
  };
  const { plan } = await prepareDaemon({
    attempts: 240,
    settings,
    platform: currentPlatform(),
    health: () => probeDaemon(settings.port),
    serviceStatus: async () => (service ? service.status() : null),
    startService: async () => service?.start(),
    spawnDaemon,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: console.log,
  });
  daemon = stopsOnExit(plan) ? daemon : null;
  handoff = createUpdateHandoff({
    plan,
    matchesService: async () =>
      !process.env.APPIMAGE && !!service && (await service.matchesRuntime()),
    async externalService() {
      if (!service) return false;
      const status = await service.status();
      return status.installed && status.port === settings.port;
    },
    stopService: async () => service?.stop(),
    startService: async () => service?.start(),
    async stopOwned() {
      const owned = daemon;
      if (!owned || owned.exitCode !== null) return;
      const exited = new Promise((resolve) => owned.once('exit', resolve));
      owned.send('pitchcrew:stop');
      let timer;
      try {
        await Promise.race([
          exited,
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('The daemon did not finish shutdown.')),
              30_000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    async startOwned() {
      if (!daemon || daemon.exitCode !== null) spawnDaemon();
    },
    answers: async () => !!(await probeDaemon(settings.port)),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  const url = `http://127.0.0.1:${settings.port}`;
  await verifyUpdateRestart(settings.directory, await readAppBuild(), url);
  process.send?.({ url, ownsDaemon: !!daemon, canUpdate: await handoff.available() });
} catch (error) {
  console.error(error);
  daemon?.kill();
  process.exit(1);
}
