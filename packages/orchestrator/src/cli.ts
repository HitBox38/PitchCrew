import { runServiceCommand } from './background/command.ts';
import { currentServiceSpec, nodeServiceHost } from './background/host.ts';
import { createBackgroundService } from './background/index.ts';
import { resolveDaemonSettings } from './background/settings.ts';
import { runDaemon } from './daemon.ts';

const args = process.argv.slice(2);
try {
  if (args[0] === 'service') {
    const spec = currentServiceSpec(resolveDaemonSettings(process.env));
    process.exitCode = await runServiceCommand(
      args.slice(1),
      spec && createBackgroundService(spec, nodeServiceHost),
    );
  } else await runDaemon(args);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
