import { win32 } from 'node:path';
import { daemonArguments, serviceFiles, serviceName } from './paths.ts';
import { escapeXml, parseWindowsArguments, quoteWindowsArgument, unescapeXml } from './quote.ts';
import type { Inspection, PlatformDriver, ServiceHost, ServiceSpec } from './types.ts';

/** conhost --headless runs the console daemon without opening a window at logon. */
export const conhostPath = (spec: ServiceSpec) =>
  win32.join(spec.systemRoot, 'System32', 'conhost.exe');

export function taskArguments(spec: ServiceSpec) {
  return ['--headless', spec.node, ...daemonArguments(spec)].map(quoteWindowsArgument).join(' ');
}

/**
 * A per-user Task Scheduler task. The logon trigger and principal name the current user with a
 * limited token, which Task Scheduler accepts without administrator rights.
 */
export function renderTaskXml(spec: ServiceSpec) {
  const user = escapeXml(spec.user);
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Runs the Pitchcrew daemon in the background for this user. Created by pnpm service install; remove it with pnpm service uninstall.</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>${user}</UserId>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${user}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${escapeXml(conhostPath(spec))}</Command>
      <Arguments>${escapeXml(taskArguments(spec))}</Arguments>
      <WorkingDirectory>${escapeXml(spec.repository)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;
}

/** schtasks reads task XML most reliably as UTF-16 with a byte order mark. */
export function encodeTaskXml(xml: string) {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')]);
}

/** Reads `schtasks /Query /XML` output: whether the task is enabled and its daemon arguments. */
export function parseTaskXml(xml: string) {
  const settings = /<Settings>([\s\S]*?)<\/Settings>/.exec(xml)?.[1] ?? '';
  const enabled = /<Enabled>\s*(true|false)\s*<\/Enabled>/.exec(settings)?.[1] !== 'false';
  const line = /<Arguments>([\s\S]*?)<\/Arguments>/.exec(xml)?.[1];
  if (line === undefined) return { enabled, args: null };
  const args = parseWindowsArguments(unescapeXml(line));
  return { enabled, args: args.slice(args[0] === '--headless' ? 2 : 1) };
}

export function windowsDriver(spec: ServiceSpec, host: ServiceHost): PlatformDriver {
  const file = serviceFiles('windows', spec.directory).task;
  const schtasks = (...args: string[]) => host.run('schtasks', args);
  const required = async (...args: string[]) => {
    const result = await schtasks(...args);
    if (result.code !== 0)
      throw new Error(
        `schtasks ${args[0]} failed: ${(result.stderr || result.stdout).trim() || `exit ${result.code}`}`,
      );
  };
  const stop = async (daemonPid: number | null) => {
    await schtasks('/End', '/TN', serviceName);
    if (!daemonPid) return;
    // Ending the task closes its console; stop the daemon directly if it is still running.
    for (let i = 0; i < 40 && host.isAlive(daemonPid); i++) await host.sleep(250);
    if (host.isAlive(daemonPid)) host.kill(daemonPid);
  };
  return {
    file,
    definition: `Task Scheduler task "${serviceName}"`,
    render: () => encodeTaskXml(renderTaskXml(spec)),
    async inspect(): Promise<Inspection> {
      const query = await schtasks('/Query', '/TN', serviceName, '/XML');
      if (query.code !== 0)
        return {
          installed: false,
          enabled: false,
          running: null,
          pid: null,
          args: null,
          detail: 'Task Scheduler has no Pitchcrew task.',
        };
      const task = parseTaskXml(query.stdout);
      return {
        installed: true,
        enabled: task.enabled,
        running: null,
        pid: null,
        args: task.args,
        detail: task.enabled ? 'Task Scheduler has the task.' : 'The task is disabled.',
      };
    },
    async register(changed, _before, daemonPid) {
      await required('/Create', '/TN', serviceName, '/XML', file, '/F');
      if (changed && daemonPid) await stop(daemonPid);
      if (changed || !daemonPid) await required('/Run', '/TN', serviceName);
    },
    async unregister(before, daemonPid) {
      if (before.installed) {
        await stop(daemonPid);
        await required('/Delete', '/TN', serviceName, '/F');
      }
      await host.remove(file);
    },
    start: () => required('/Run', '/TN', serviceName),
    stop: (_before, daemonPid) => stop(daemonPid),
  };
}
