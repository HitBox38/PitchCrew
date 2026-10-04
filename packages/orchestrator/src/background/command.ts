import type { BackgroundServiceStatus } from '@pitchcrew/core';
import type { BackgroundService } from './index.ts';
import { samePath } from './paths.ts';
import { flagValue } from './settings.ts';

export const serviceUsage = `Usage: pnpm service <command>

  install     Run the production daemon in the background at login
  uninstall   Stop the background service and remove its files
  status      Show whether it is installed and running (--json for details)
  start       Start the background daemon now
  stop        Stop the background daemon until the next login
  logs        Show recent log lines (--lines <count>)

The service uses PITCHCREW_HOME and PITCHCREW_PORT from this shell.`;

export function formatServiceStatus(status: BackgroundServiceStatus, service: BackgroundService) {
  if (!status.installed) return [`Background service: not installed`, status.detail];
  const state = [
    'installed',
    status.enabled ? 'starts at login' : 'does not start at login',
    status.running ? `running${status.pid ? ` (process ${status.pid})` : ''}` : 'stopped',
  ];
  const lines = [
    `Background service: ${state.join(', ')}`,
    ...(status.port ? [`Address: http://127.0.0.1:${status.port}`] : []),
    ...(status.directory ? [`Data folder: ${status.directory}`] : []),
    `Definition: ${status.definition}`,
    `Logs: ${status.logFile}`,
    status.detail,
  ];
  const { spec } = service;
  if (status.port !== spec.port || !samePath(spec.platform, status.directory, spec.directory))
    lines.push(
      `This shell uses ${spec.directory} on port ${spec.port}. Run pnpm service install to switch the service to it.`,
    );
  return lines;
}

/** Runs `pnpm service <command>` and returns the process exit code. */
export async function runServiceCommand(
  args: readonly string[],
  service: BackgroundService | null,
  print: (line: string) => void = (line) => console.log(line),
) {
  const [command] = args;
  if (!command || command === 'help' || command === '--help') {
    print(serviceUsage);
    return command ? 0 : 1;
  }
  if (!service) {
    print('The background service supports Windows, macOS and Linux.');
    return 1;
  }
  const show = (lines: string[]) => lines.filter(Boolean).forEach((line) => print(line));
  switch (command) {
    case 'install': {
      const result = await service.install();
      print(
        result.changed
          ? 'Installed the background service. It starts when you log in.'
          : 'The background service is already installed with these settings.',
      );
      show([...result.notes, ...formatServiceStatus(result.status, service)]);
      return 0;
    }
    case 'uninstall': {
      const result = await service.uninstall();
      print(
        result.removed.length
          ? `Removed the background service:\n${result.removed.map((item) => `  ${item}`).join('\n')}`
          : 'The background service is not installed.',
      );
      return 0;
    }
    case 'status': {
      const status = await service.status();
      if (args.includes('--json')) print(JSON.stringify(status, null, 2));
      else show(formatServiceStatus(status, service));
      return 0;
    }
    case 'start':
      await service.start();
      print('Started the background service.');
      return 0;
    case 'stop':
      await service.stop();
      print(
        'Stopped the background service. It starts again at your next login, or with pnpm service start.',
      );
      return 0;
    case 'logs': {
      const lines = Number(flagValue(args, '--lines') ?? 200);
      if (!Number.isInteger(lines) || lines < 1)
        throw new Error('--lines must be a positive whole number.');
      const logs = await service.logs(lines);
      if (!logs.files.length) {
        print('No background service logs yet.');
        return 0;
      }
      print(`Log files:\n${logs.files.map((file) => `  ${file}`).join('\n')}\n`);
      if (logs.text) print(logs.text);
      if (service.spec.platform === 'linux')
        print('\nsystemd also keeps startup output: journalctl --user -u pitchcrew.service');
      return 0;
    }
    default:
      print(`Unknown service command: ${command}\n\n${serviceUsage}`);
      return 1;
  }
}
