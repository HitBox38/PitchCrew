import { join } from 'node:path';
import { DaemonRunningError, probeDaemon } from './background/lock.ts';
import { capLogFile, captureServiceOutput, createRotatingLog } from './background/log.ts';
import { serviceFolderName } from './background/paths.ts';
import { resolveDaemonSettings } from './background/settings.ts';
import { createDaemon } from './server.ts';
import { analyticsConfig } from './http/analytics.ts';

/**
 * Starts the daemon from the command line. A daemon started by the background service (--service)
 * always runs the production UI, logs to its data folder and waits while another daemon owns the
 * data folder or port; an interactive start refuses instead.
 */
export async function runDaemon(argv: readonly string[]) {
  const { directory, port } = resolveDaemonSettings(process.env, argv);
  const service = argv.includes('--service');
  const dev = argv.includes('--dev') && !service;
  if (service) {
    const folder = join(directory, serviceFolderName);
    capLogFile(join(folder, 'launchd.log'));
    captureServiceOutput(createRotatingLog(join(folder, 'daemon.log')));
  }
  let announced = false;
  const blocked = async (message: string) => {
    if (!service) throw new Error(`${message} Open that address, or stop it first.`);
    if (!announced) console.log(`${message} The background service waits for it to stop.`);
    announced = true;
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  };
  let daemon: Awaited<ReturnType<typeof createDaemon>>;
  for (;;) {
    const running = await probeDaemon(port);
    if (running) {
      await blocked(
        `Pitchcrew is already running at http://127.0.0.1:${port}${running.service ? ' (background service)' : ''}.`,
      );
      continue;
    }
    try {
      daemon = await createDaemon({
        directory,
        port,
        dev,
        service,
        seedSkills: process.env.PITCHCREW_SEED_SKILLS !== '0',
        analytics: analyticsConfig(process.env, dev),
        updates: { enabled: process.env.PITCHCREW_UPDATE_CHECKS !== '0', automatic: !dev },
      });
      break;
    } catch (error) {
      if (!(error instanceof DaemonRunningError)) throw error;
      await blocked(error.message);
    }
  }
  daemon.http.on('error', async (error: NodeJS.ErrnoException) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Port ${port} is in use by another program. Set PITCHCREW_PORT to a free port.`
        : error.message,
    );
    await daemon.close();
    process.exitCode = 1;
  });
  daemon.http.listen(port, '127.0.0.1', () =>
    console.log(
      `Pitchcrew${service ? ' background service' : ''} is ready at ${daemon.url}\nLocal data: ${directory}`,
    ),
  );
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    await daemon.close();
    process.exit(0);
  };
  // Windows sends SIGHUP when Task Scheduler ends the task and closes its console.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
    process.on(signal, () => {
      void stop();
    });
}
