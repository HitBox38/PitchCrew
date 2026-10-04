import type { BackgroundServicePlatform } from '@pitchcrew/core';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { isProcessAlive, probeDaemon } from './lock.ts';
import { cliEntry, repositoryRoot, type DaemonSettings } from './settings.ts';
import type { CommandResult, ServiceHost, ServiceSpec } from './types.ts';

/** schtasks can write UTF-16 when its output is redirected; other tools write UTF-8. */
export function decodeOutput(output: Buffer) {
  if (output[0] === 0xff && output[1] === 0xfe) return output.subarray(2).toString('utf16le');
  const sample = output.subarray(0, 64);
  const zeros = sample.filter((byte, index) => index % 2 === 1 && byte === 0).length;
  if (sample.length >= 4 && zeros >= sample.length / 4) return output.toString('utf16le');
  return output.toString('utf8');
}

export const nodeServiceHost: ServiceHost = {
  run: (command, args) =>
    new Promise<CommandResult>((resolve) => {
      execFile(
        command,
        [...args],
        { encoding: 'buffer', timeout: 30_000, windowsHide: true },
        (error, stdout, stderr) => {
          const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
          resolve({
            code,
            stdout: decodeOutput(stdout),
            stderr:
              decodeOutput(stderr) ||
              ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
                ? `${command} was not found.`
                : (error?.message ?? '')),
          });
        },
      );
    }),
  readFile: (path) => readFile(path).catch(() => null),
  async writeFile(path, data) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  },
  makeFolder: async (path) => {
    await mkdir(path, { recursive: true });
  },
  remove: (path) => rm(path, { recursive: true, force: true }),
  isAlive: isProcessAlive,
  answers: async (port) => !!(await probeDaemon(port)),
  kill: (pid) => {
    try {
      process.kill(pid);
    } catch {
      /* The daemon already exited. */
    }
  },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export function currentPlatform(): BackgroundServicePlatform | null {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'linux') return 'linux';
  return null;
}

/** The definition values for this user, this Node executable and this checkout. */
export function currentServiceSpec(
  settings: DaemonSettings,
  env: NodeJS.ProcessEnv = process.env,
): ServiceSpec | null {
  const platform = currentPlatform();
  if (!platform) return null;
  const home = homedir();
  const username = env.USERNAME ?? userInfo().username;
  return {
    platform,
    ...settings,
    repository: repositoryRoot.replace(/[\\/]+$/, ''),
    node: process.execPath,
    cli: cliEntry,
    home,
    configHome:
      env.XDG_CONFIG_HOME && isAbsolute(env.XDG_CONFIG_HOME)
        ? env.XDG_CONFIG_HOME
        : join(home, '.config'),
    path: env.PATH ?? env.Path ?? '',
    uid: process.getuid?.() ?? 0,
    user: env.USERDOMAIN ? `${env.USERDOMAIN}\\${username}` : username,
    systemRoot: env.SystemRoot ?? env.SYSTEMROOT ?? 'C:\\Windows',
  };
}
