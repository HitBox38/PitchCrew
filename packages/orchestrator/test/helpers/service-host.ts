import type { BackgroundServicePlatform } from '@pitchcrew/core';
import { posix, win32 } from 'node:path';
import { decodeOutput } from '../../src/background/host.ts';
import type { CommandResult, ServiceHost, ServiceSpec } from '../../src/background/types.ts';

const ok = (stdout = ''): CommandResult => ({ code: 0, stdout, stderr: '' });

export const fixtureSpecs: Record<BackgroundServicePlatform, ServiceSpec> = {
  windows: {
    platform: 'windows',
    directory: 'C:\\Users\\Fixture User\\Pitchcrew Data',
    port: 4418,
    repository: 'C:\\Projects\\Pitch Crew',
    node: 'C:\\Program Files\\nodejs\\node.exe',
    cli: 'C:\\Projects\\Pitch Crew\\packages\\orchestrator\\src\\cli.ts',
    home: 'C:\\Users\\Fixture User',
    configHome: 'C:\\Users\\Fixture User\\.config',
    path: 'C:\\Windows\\System32',
    uid: 0,
    user: 'FIXTURE-PC\\Fixture User',
    systemRoot: 'C:\\Windows',
  },
  macos: {
    platform: 'macos',
    directory: '/Users/fixture user/Pitchcrew Data & Notes',
    port: 4418,
    repository: '/Users/fixture user/Projects/Pitch Crew',
    node: '/Users/fixture user/.nvm/versions/node/v22.18.0/bin/node',
    cli: '/Users/fixture user/Projects/Pitch Crew/packages/orchestrator/src/cli.ts',
    home: '/Users/fixture user',
    configHome: '/Users/fixture user/.config',
    path: '/opt/homebrew/bin:/usr/bin:/bin',
    uid: 501,
    user: 'fixture',
    systemRoot: '',
  },
  linux: {
    platform: 'linux',
    directory: '/home/fixture user/data 100% $HOME "quoted"',
    port: 4418,
    repository: '/home/fixture user/Pitch Crew',
    node: '/home/fixture user/.local/node/bin/node',
    cli: '/home/fixture user/Pitch Crew/packages/orchestrator/src/cli.ts',
    home: '/home/fixture user',
    configHome: '/home/fixture user/.config',
    // pnpm adds node_modules/.bin folders while scripts run; they never reach the unit.
    path: '/home/fixture user/Pitch Crew/node_modules/.bin:/home/fixture user/.local/bin:/home/fixture user/.npm/_npx/1/node_modules/.bin:/usr/bin:relative:/bin:/usr/bin',
    uid: 1000,
    user: 'fixture',
    systemRoot: '',
  },
};

/**
 * An in-memory file system plus a simulated service manager that follows the commands it is
 * given. No schtasks, launchctl or systemctl process is ever started.
 */
export function fakeServiceHost(platform: BackgroundServicePlatform, spec: ServiceSpec) {
  const path = platform === 'windows' ? win32 : posix;
  const files = new Map<string, Buffer>();
  const folders = new Set<string>();
  const calls: string[] = [];
  const alive = new Set<number>();
  const killed: number[] = [];
  const manager = {
    registered: null as string | null,
    enabled: false,
    running: false,
    pid: 0,
    /** Data folder where the simulated daemon writes its lock. */
    directory: spec.directory,
    /** Simulates a daemon that outlives schtasks /End. */
    ignoresEnd: false,
  };
  let nextPid = 4242;
  const lockFor = (directory: string) => path.join(directory, 'daemon.lock');
  const startDaemon = () => {
    manager.running = true;
    manager.pid = nextPid++;
    alive.add(manager.pid);
    files.set(
      lockFor(manager.directory),
      Buffer.from(
        JSON.stringify({
          pid: manager.pid,
          port: spec.port,
          service: true,
          startedAt: new Date().toISOString(),
          bootedAt: '',
          token: `fixture-${manager.pid}`,
        }),
      ),
    );
  };
  const stopDaemon = () => {
    manager.running = false;
    alive.delete(manager.pid);
  };
  const respond = (command: string, args: readonly string[]): CommandResult => {
    if (command === 'systemctl') {
      const [, action, ...rest] = args;
      if (action === 'show') {
        const loaded = files.has(posix.join(spec.configHome, 'systemd/user/pitchcrew.service'));
        return ok(
          [
            `LoadState=${loaded ? 'loaded' : 'not-found'}`,
            `ActiveState=${manager.running ? 'active' : 'inactive'}`,
            `SubState=${manager.running ? 'running' : 'dead'}`,
            `UnitFileState=${manager.enabled ? 'enabled' : 'disabled'}`,
            `MainPID=${manager.running ? manager.pid : 0}`,
          ].join('\n'),
        );
      }
      if (action === 'enable') {
        manager.enabled = true;
        if (rest.includes('--now') && !manager.running) startDaemon();
      }
      if (action === 'disable') {
        manager.enabled = false;
        if (rest.includes('--now')) stopDaemon();
      }
      if (action === 'restart') {
        stopDaemon();
        startDaemon();
      }
      if (action === 'start' && !manager.running) startDaemon();
      if (action === 'stop') stopDaemon();
      return ok();
    }
    if (command === 'launchctl') {
      const [action] = args;
      if (action === 'print')
        return manager.registered
          ? ok(
              `gui/501/local.pitchcrew.daemon = {\n\tactive count = 1\n\tstate = ${manager.running ? 'running' : 'not running'}\n${manager.running ? `\tpid = ${manager.pid}\n` : ''}}`,
            )
          : { code: 113, stdout: '', stderr: 'Could not find service in domain.' };
      if (action === 'bootstrap') {
        if (manager.registered) return { code: 5, stdout: '', stderr: 'Input/output error' };
        manager.registered = decodeOutput(files.get(args[2])!);
        startDaemon();
      }
      if (action === 'bootout') {
        manager.registered = null;
        stopDaemon();
      }
      if (action === 'kickstart' && !manager.running) startDaemon();
      return ok();
    }
    if (command === 'schtasks') {
      const [action] = args;
      if (action === '/Query')
        return manager.registered
          ? ok(manager.registered)
          : { code: 1, stdout: '', stderr: 'ERROR: The system cannot find the file specified.' };
      if (action === '/Create') manager.registered = decodeOutput(files.get(args[4])!);
      if (action === '/Run' && !manager.running) startDaemon();
      if (action === '/End' && !manager.ignoresEnd) stopDaemon();
      if (action === '/Delete') manager.registered = null;
      return ok();
    }
    return { code: 127, stdout: '', stderr: `${command} was not found.` };
  };
  const host: ServiceHost = {
    async run(command, args) {
      calls.push([command, ...args].join(' '));
      return respond(command, args);
    },
    readFile: async (file) => files.get(file) ?? null,
    async writeFile(file, data) {
      files.set(file, Buffer.from(data));
    },
    async makeFolder(folder) {
      folders.add(folder);
    },
    async remove(target) {
      for (const file of [...files.keys()])
        if (file === target || file.startsWith(`${target}${path.sep}`)) files.delete(file);
      folders.delete(target);
    },
    isAlive: (pid) => alive.has(pid),
    answers: async () => manager.running,
    kill(pid) {
      killed.push(pid);
      if (pid === manager.pid) stopDaemon();
      alive.delete(pid);
    },
    sleep: async () => {},
  };
  files.set(path.join(spec.repository, 'packages', 'ui', 'dist', 'index.html'), Buffer.from('ui'));
  return { host, files, folders, calls, alive, killed, manager };
}
