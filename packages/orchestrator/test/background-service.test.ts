import type { BackgroundServicePlatform } from '@pitchcrew/core';
import { posix, win32 } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runServiceCommand } from '../src/background/command.ts';
import { decodeOutput } from '../src/background/host.ts';
import { createBackgroundService } from '../src/background/index.ts';
import { parseSystemctlShow, readExecStart, renderSystemdUnit } from '../src/background/linux.ts';
import {
  parseLaunchctlPrint,
  readProgramArguments,
  renderLaunchAgent,
} from '../src/background/macos.ts';
import { daemonArguments } from '../src/background/paths.ts';
import {
  parseSystemdArguments,
  parseWindowsArguments,
  quoteSystemdArgument,
  quoteWindowsArgument,
} from '../src/background/quote.ts';
import { encodeTaskXml, parseTaskXml, renderTaskXml } from '../src/background/windows.ts';
import { fakeServiceHost, fixtureSpecs } from './helpers/service-host.ts';

const platforms: BackgroundServicePlatform[] = ['windows', 'macos', 'linux'];
const showProperties = '--property=LoadState,ActiveState,SubState,UnitFileState,MainPID';

describe('service definitions', () => {
  it('writes a systemd user unit with quoted paths, escaped specifiers and PATH only', () => {
    const spec = fixtureSpecs.linux;
    const unit = renderSystemdUnit(spec);
    expect(unit).toBe(`# Created by pnpm service install. Remove it with pnpm service uninstall.
[Unit]
Description=Pitchcrew background daemon
StartLimitIntervalSec=0

[Service]
Type=simple
WorkingDirectory=/home/fixture user/Pitch Crew
Environment="PATH=/home/fixture user/.local/node/bin:/home/fixture user/.local/bin:/usr/bin:/bin"
ExecStart="/home/fixture user/.local/node/bin/node" "--import" "tsx" "/home/fixture user/Pitch Crew/packages/orchestrator/src/cli.ts" "--service" "--home" "/home/fixture user/data 100%% $$HOME \\"quoted\\"" "--port" "4418"
Restart=on-failure
RestartSec=30
TimeoutStopSec=30

[Install]
WantedBy=default.target
`);
    expect(readExecStart(unit)).toEqual(daemonArguments(spec));
    expect(unit).not.toContain('--dev');
  });

  it('writes a LaunchAgent that loads at login, restarts after failure and escapes XML', () => {
    const spec = fixtureSpecs.macos;
    const plist = renderLaunchAgent(spec);
    expect(plist).toContain(`  <key>ProgramArguments</key>
  <array>
    <string>/Users/fixture user/.nvm/versions/node/v22.18.0/bin/node</string>
    <string>--import</string>
    <string>tsx</string>
    <string>/Users/fixture user/Projects/Pitch Crew/packages/orchestrator/src/cli.ts</string>
    <string>--service</string>
    <string>--home</string>
    <string>/Users/fixture user/Pitchcrew Data &amp; Notes</string>
    <string>--port</string>
    <string>4418</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/fixture user/Projects/Pitch Crew</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/Users/fixture user/.nvm/versions/node/v22.18.0/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>`);
    expect(plist).toContain(
      '<string>/Users/fixture user/Pitchcrew Data &amp; Notes/background-service/launchd.log</string>',
    );
    expect(plist).toContain('<string>local.pitchcrew.daemon</string>');
    expect(readProgramArguments(plist)).toEqual(daemonArguments(spec));
  });

  it('writes a hidden, per-user, limited Task Scheduler task as UTF-16', () => {
    const spec = fixtureSpecs.windows;
    const xml = renderTaskXml(spec);
    const encoded = encodeTaskXml(xml);
    expect([...encoded.subarray(0, 2)]).toEqual([0xff, 0xfe]);
    expect(decodeOutput(encoded)).toBe(xml);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-16"?>');
    expect(xml).toContain(`    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>FIXTURE-PC\\Fixture User</UserId>
    </LogonTrigger>`);
    expect(xml).toContain(`      <UserId>FIXTURE-PC\\Fixture User</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>`);
    expect(xml).toContain(`    <Exec>
      <Command>C:\\Windows\\System32\\conhost.exe</Command>
      <Arguments>--headless &quot;C:\\Program Files\\nodejs\\node.exe&quot; --import tsx &quot;C:\\Projects\\Pitch Crew\\packages\\orchestrator\\src\\cli.ts&quot; --service --home &quot;C:\\Users\\Fixture User\\Pitchcrew Data&quot; --port 4418</Arguments>
      <WorkingDirectory>C:\\Projects\\Pitch Crew</WorkingDirectory>
    </Exec>`);
    for (const setting of [
      '<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>',
      '<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>',
      '<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>',
      '<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>',
      '<RestartOnFailure>\n      <Interval>PT1M</Interval>\n      <Count>999</Count>\n    </RestartOnFailure>',
    ])
      expect(xml).toContain(setting);
    expect(xml).not.toContain('HighestAvailable');
    expect(parseTaskXml(xml)).toEqual({ enabled: true, args: daemonArguments(spec) });
  });

  it('round-trips awkward Windows and systemd arguments', () => {
    const values = [
      '',
      'plain',
      'with space',
      'C:\\folder with space\\',
      'say "hi"',
      'back\\\\"slash',
      'tab\there',
      '100% $HOME',
    ];
    const windows = values.map(quoteWindowsArgument).join(' ');
    expect(parseWindowsArguments(windows)).toEqual(values);
    expect(quoteWindowsArgument('C:\\folder with space\\')).toBe('"C:\\folder with space\\\\"');
    expect(parseSystemdArguments(values.map(quoteSystemdArgument).join(' '))).toEqual(values);
    expect(() => quoteSystemdArgument('line\nbreak')).toThrow('line breaks');
  });
});

describe('status parsing', () => {
  it('reads systemctl show output', () => {
    expect(
      parseSystemctlShow(
        'LoadState=loaded\nActiveState=active\nSubState=running\nUnitFileState=enabled\nMainPID=812\n',
      ),
    ).toEqual({ loaded: true, active: true, state: 'active running', enabled: true, pid: 812 });
    expect(
      parseSystemctlShow(
        'LoadState=not-found\nActiveState=inactive\nSubState=dead\nUnitFileState=\nMainPID=0',
      ),
    ).toEqual({ loaded: false, active: false, state: 'inactive dead', enabled: false, pid: null });
  });

  it('reads the service state from launchctl print output', () => {
    const running = `gui/501/local.pitchcrew.daemon = {
\tactive count = 1
\tpath = /Users/fixture/Library/LaunchAgents/local.pitchcrew.daemon.plist
\ttype = LaunchAgent
\tstate = running

\tprogram = /usr/local/bin/node
\targuments = {
\t\t/usr/local/bin/node
\t}
\tpid = 4242
\timmediate reason = speculative
\tendpoints = {
\t}
}`;
    expect(parseLaunchctlPrint(running)).toEqual({ state: 'running', running: true, pid: 4242 });
    expect(
      parseLaunchctlPrint(
        'gui/501/local.pitchcrew.daemon = {\n\tstate = not running\n\tlast exit code = 1\n}',
      ),
    ).toEqual({ state: 'not running', running: false, pid: null });
  });

  it('reads schtasks XML output, including UTF-16 output and a disabled task', () => {
    const xml = renderTaskXml(fixtureSpecs.windows).replace(
      '<Enabled>true</Enabled>\n    <Hidden>',
      '<Enabled>false</Enabled>\n    <Hidden>',
    );
    const output = decodeOutput(Buffer.from(xml, 'utf16le'));
    expect(parseTaskXml(output)).toEqual({
      enabled: false,
      args: daemonArguments(fixtureSpecs.windows),
    });
    expect(parseTaskXml('<Task></Task>')).toEqual({ enabled: true, args: null });
  });

  it('reports an unavailable systemd user manager without failing', async () => {
    const spec = fixtureSpecs.linux;
    const fake = fakeServiceHost('linux', spec);
    fake.host.run = async () => ({ code: 1, stdout: '', stderr: 'Failed to connect to bus' });
    const status = await createBackgroundService(spec, fake.host).status();
    expect(status).toMatchObject({ installed: false, running: false });
    expect(status.detail).toContain('Failed to connect to bus');
  });
});

describe('install, status and uninstall', () => {
  const definitionFile = (platform: BackgroundServicePlatform) =>
    ({
      windows: 'C:\\Users\\Fixture User\\Pitchcrew Data\\background-service\\pitchcrew-task.xml',
      macos: '/Users/fixture user/Library/LaunchAgents/local.pitchcrew.daemon.plist',
      linux: '/home/fixture user/.config/systemd/user/pitchcrew.service',
    })[platform];
  const firstInstall: Record<BackgroundServicePlatform, string[]> = {
    windows: [
      'schtasks /Query /TN Pitchcrew /XML',
      `schtasks /Create /TN Pitchcrew /XML ${definitionFile('windows')} /F`,
      'schtasks /Run /TN Pitchcrew',
    ],
    macos: [
      'launchctl print gui/501/local.pitchcrew.daemon',
      'launchctl enable gui/501/local.pitchcrew.daemon',
      `launchctl bootstrap gui/501 ${definitionFile('macos')}`,
    ],
    linux: [
      `systemctl --user show pitchcrew.service ${showProperties}`,
      'systemctl --user daemon-reload',
      'systemctl --user enable --now pitchcrew.service',
    ],
  };
  const restartCommands: Record<BackgroundServicePlatform, string[]> = {
    windows: ['schtasks /End /TN Pitchcrew', 'schtasks /Run /TN Pitchcrew'],
    macos: [
      'launchctl bootout gui/501/local.pitchcrew.daemon',
      `launchctl bootstrap gui/501 ${definitionFile('macos')}`,
    ],
    linux: ['systemctl --user restart pitchcrew.service'],
  };

  it.each(platforms)(
    'installs idempotently and applies changed settings on %s',
    async (platform) => {
      const spec = fixtureSpecs[platform];
      const fake = fakeServiceHost(platform, spec);
      const service = createBackgroundService(spec, fake.host);
      const first = await service.install();
      expect(first.changed).toBe(true);
      expect(fake.calls.slice(0, firstInstall[platform].length)).toEqual(firstInstall[platform]);
      expect(fake.files.has(definitionFile(platform))).toBe(true);
      expect(first.status).toMatchObject({
        platform,
        installed: true,
        enabled: true,
        running: true,
        pid: 4242,
        directory: spec.directory,
        port: spec.port,
      });
      expect(first.status.logFile).toBe(
        (platform === 'windows' ? win32 : posix).join(
          spec.directory,
          'background-service',
          'daemon.log',
        ),
      );

      fake.calls.length = 0;
      const second = await service.install();
      expect(second.changed).toBe(false);
      expect(second.status.pid).toBe(4242);
      for (const command of restartCommands[platform]) expect(fake.calls).not.toContain(command);

      fake.calls.length = 0;
      const moved = createBackgroundService({ ...spec, port: 4419 }, fake.host);
      const third = await moved.install();
      expect(third.changed).toBe(true);
      for (const command of restartCommands[platform]) expect(fake.calls).toContain(command);
      expect(third.status).toMatchObject({ running: true, pid: 4243, port: 4419 });
    },
  );

  it.each(platforms)('uninstalls everything install created on %s', async (platform) => {
    const spec = fixtureSpecs[platform];
    const fake = fakeServiceHost(platform, spec);
    const service = createBackgroundService(spec, fake.host);
    await service.install();
    const path = platform === 'windows' ? win32 : posix;
    const log = path.join(spec.directory, 'background-service', 'daemon.log');
    fake.files.set(log, Buffer.from('fixture log line\n'));
    fake.files.set(path.join(spec.directory, 'pitchcrew.db'), Buffer.from('board'));
    const result = await service.uninstall();
    expect(result.removed).toContain(path.join(spec.directory, 'background-service'));
    expect(fake.files.has(definitionFile(platform))).toBe(false);
    expect(fake.files.has(log)).toBe(false);
    expect(fake.files.has(path.join(spec.directory, 'pitchcrew.db'))).toBe(true);
    expect(fake.manager.running).toBe(false);
    expect(fake.manager.registered ?? (fake.manager.enabled ? 'enabled' : null)).toBeNull();
    expect(await service.status()).toMatchObject({ installed: false, running: false });
    // A second uninstall finds nothing left to stop.
    expect((await service.uninstall()).removed).toEqual([
      path.join(spec.directory, 'background-service'),
    ]);
    await expect(service.start()).rejects.toThrow('not installed');
  });

  it('starts and stops the service, and ends a Windows daemon that outlives its task', async () => {
    for (const platform of platforms) {
      const spec = fixtureSpecs[platform];
      const fake = fakeServiceHost(platform, spec);
      const service = createBackgroundService(spec, fake.host);
      await service.install();
      fake.manager.ignoresEnd = platform === 'windows';
      await service.stop();
      if (platform === 'windows') expect(fake.killed).toEqual([4242]);
      expect(await service.status()).toMatchObject({ installed: true, running: false });
      await service.start();
      expect(await service.status()).toMatchObject({ running: true, pid: 4243 });
    }
  });

  it('refuses to install without the built UI or with a Task Scheduler percent path', async () => {
    const spec = fixtureSpecs.linux;
    const fake = fakeServiceHost('linux', spec);
    fake.files.clear();
    await expect(createBackgroundService(spec, fake.host).install()).rejects.toThrow('pnpm build');
    expect(fake.calls).toEqual([]);
    const windows = { ...fixtureSpecs.windows, directory: 'C:\\Users\\Fixture\\100%done' };
    const windowsFake = fakeServiceHost('windows', windows);
    await expect(createBackgroundService(windows, windowsFake.host).install()).rejects.toThrow(
      'percent sign',
    );
  });

  it('keeps the previous definition when the service manager rejects an install', async () => {
    const spec = fixtureSpecs.linux;
    const fake = fakeServiceHost('linux', spec);
    const run = fake.host.run;
    fake.host.run = async (command, args) =>
      args.includes('daemon-reload')
        ? { code: 1, stdout: '', stderr: 'Failed to connect to bus' }
        : run(command, args);
    const service = createBackgroundService(spec, fake.host);
    await expect(service.install()).rejects.toThrow('Failed to connect to bus');
    expect(fake.files.has(definitionFile('linux'))).toBe(false);
    fake.files.set(definitionFile('linux'), Buffer.from('previous unit'));
    await expect(service.install()).rejects.toThrow('daemon-reload');
    expect(fake.files.get(definitionFile('linux'))?.toString()).toBe('previous unit');
  });

  it('explains that the service waits while another daemon uses the data folder', async () => {
    const spec = fixtureSpecs.linux;
    const fake = fakeServiceHost('linux', spec);
    fake.alive.add(777);
    fake.files.set(
      posix.join(spec.directory, 'daemon.lock'),
      Buffer.from(
        JSON.stringify({
          pid: 777,
          port: spec.port,
          service: false,
          startedAt: new Date().toISOString(),
          bootedAt: '',
          token: 'fixture',
        }),
      ),
    );
    fake.manager.directory = posix.join(spec.home, 'unused');
    const result = await createBackgroundService(spec, fake.host).install();
    expect(result.notes[0]).toContain('process 777');
    expect(result.status.detail).toContain('waits for it to stop');
  });

  it('shows the newest log lines across rotated files', async () => {
    const spec = fixtureSpecs.macos;
    const fake = fakeServiceHost('macos', spec);
    const folder = posix.join(spec.directory, 'background-service');
    fake.files.set(`${folder}/daemon.log.1`, Buffer.from('old 1\nold 2\n'));
    fake.files.set(`${folder}/daemon.log`, Buffer.from('new 1\nnew 2\n'));
    const logs = await createBackgroundService(spec, fake.host).logs(3);
    expect(logs.files).toEqual([`${folder}/daemon.log.1`, `${folder}/daemon.log`]);
    expect(logs.text).toBe('old 2\nnew 1\nnew 2');
  });
});

describe('service command', () => {
  it('prints status, install results and usage', async () => {
    const spec = fixtureSpecs.linux;
    const service = createBackgroundService(spec, fakeServiceHost('linux', spec).host);
    const lines: string[] = [];
    const print = (line: string) => lines.push(line);
    expect(await runServiceCommand(['status'], service, print)).toBe(0);
    expect(lines[0]).toBe('Background service: not installed');
    lines.length = 0;
    expect(await runServiceCommand(['install'], service, print)).toBe(0);
    expect(lines.slice(0, 3)).toEqual([
      'Installed the background service. It starts when you log in.',
      'Background service: installed, starts at login, running (process 4242)',
      'Address: http://127.0.0.1:4418',
    ]);
    lines.length = 0;
    expect(await runServiceCommand(['status', '--json'], service, print)).toBe(0);
    expect(JSON.parse(lines[0])).toMatchObject({ installed: true, port: 4418 });
    expect(await runServiceCommand(['restart'], service, print)).toBe(1);
    expect(await runServiceCommand(['status'], null, print)).toBe(1);
    expect(lines.at(-1)).toContain('Windows, macOS and Linux');
  });
});
