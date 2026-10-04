import { posix } from 'node:path';
import { daemonArguments, systemdUnit } from './paths.ts';
import {
  escapeSystemdPath,
  parseSystemdArguments,
  quoteSystemdArgument,
  quoteSystemdEnvironment,
} from './quote.ts';
import { servicePath } from './environment.ts';
import type { Inspection, PlatformDriver, ServiceHost, ServiceSpec } from './types.ts';

export const systemdUnitPath = (spec: ServiceSpec) =>
  posix.join(spec.configHome, 'systemd', 'user', systemdUnit);

/** A systemd user unit; it starts with the user's session and restarts after a failure. */
export function renderSystemdUnit(spec: ServiceSpec) {
  const command = [spec.node, ...daemonArguments(spec)].map(quoteSystemdArgument).join(' ');
  return `# Created by pnpm service install. Remove it with pnpm service uninstall.
[Unit]
Description=Pitchcrew background daemon
StartLimitIntervalSec=0

[Service]
Type=simple
WorkingDirectory=${escapeSystemdPath(spec.repository)}
Environment=${quoteSystemdEnvironment('PATH', servicePath(spec))}
ExecStart=${command}
Restart=on-failure
RestartSec=30
TimeoutStopSec=30

[Install]
WantedBy=default.target
`;
}

/** Reads `systemctl --user show` key=value output. */
export function parseSystemctlShow(output: string) {
  const values = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.split(/=(.*)/s, 2))
      .filter((pair): pair is [string, string] => pair.length === 2 && !!pair[0]),
  );
  const pid = Number(values.MainPID);
  return {
    loaded: values.LoadState === 'loaded',
    active: values.ActiveState === 'active',
    state: [values.ActiveState, values.SubState].filter(Boolean).join(' '),
    enabled: values.UnitFileState === 'enabled',
    pid: Number.isInteger(pid) && pid > 0 ? pid : null,
  };
}

export function readExecStart(unit: string) {
  const line = unit.split(/\r?\n/).find((entry) => entry.startsWith('ExecStart='));
  return line ? parseSystemdArguments(line.slice('ExecStart='.length)).slice(1) : null;
}

export function linuxDriver(spec: ServiceSpec, host: ServiceHost): PlatformDriver {
  const file = systemdUnitPath(spec);
  const systemctl = (...args: string[]) => host.run('systemctl', ['--user', ...args]);
  const required = async (...args: string[]) => {
    const result = await systemctl(...args);
    if (result.code !== 0)
      throw new Error(
        `systemctl --user ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim() || `exit ${result.code}`}`,
      );
  };
  return {
    file,
    definition: file,
    render: () => renderSystemdUnit(spec),
    async inspect(): Promise<Inspection> {
      const unit = await host.readFile(file);
      const show = await systemctl(
        'show',
        systemdUnit,
        '--property=LoadState,ActiveState,SubState,UnitFileState,MainPID',
      );
      const state = parseSystemctlShow(show.stdout);
      const detail =
        show.code === 0
          ? `systemd reports ${state.state || 'no state'}.`
          : `systemd user services are unavailable: ${(show.stderr || show.stdout).trim() || `exit ${show.code}`}`;
      return {
        installed: !!unit,
        enabled: !!unit && state.enabled,
        running: show.code === 0 ? state.active : null,
        pid: state.pid,
        args: unit ? readExecStart(unit.toString('utf8')) : null,
        detail,
      };
    },
    async register(changed, before) {
      await required('daemon-reload');
      await required('enable', '--now', systemdUnit);
      // enable --now leaves a running daemon alone, so apply a changed definition explicitly.
      if (changed && before.running) await required('restart', systemdUnit);
    },
    async unregister(before) {
      if (before.installed || before.running) await required('disable', '--now', systemdUnit);
      await host.remove(file);
      await systemctl('daemon-reload');
      await systemctl('reset-failed', systemdUnit);
    },
    start: () => required('start', systemdUnit),
    stop: () => required('stop', systemdUnit),
  };
}
