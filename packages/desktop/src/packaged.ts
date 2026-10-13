import { fork, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

let launcher: ChildProcess | undefined;
let canUpdate = false;
let requestId = 0;

export async function startPackagedDaemon(resources: string) {
  const runtime = join(resources, 'runtime');
  launcher = fork(join(runtime, 'scripts/packaged-launcher.ts'), [], {
    execPath: join(runtime, 'node', process.platform === 'win32' ? 'node.exe' : 'node'),
    execArgv: ['--import', 'tsx'],
    cwd: runtime,
    windowsHide: true,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(runtime, 'browsers') },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  return new Promise<string>((resolve, reject) => {
    launcher!.once('error', reject);
    launcher!.once('exit', (code) => reject(new Error(`Local daemon launcher exited (${code}).`)));
    launcher!.once('message', (message: unknown) => {
      if (
        !message ||
        typeof message !== 'object' ||
        !('url' in message) ||
        typeof message.url !== 'string'
      ) {
        reject(new Error('Invalid local daemon response.'));
        return;
      }
      canUpdate = 'canUpdate' in message && message.canUpdate === true;
      resolve(message.url);
    });
  });
}

export function stopPackagedDaemon() {
  if (launcher?.connected) launcher.send('stop');
}

export const canUpdatePackagedDaemon = () => canUpdate;

export function requestDaemonUpdate(action: 'prepare-update' | 'recover-update', version?: string) {
  return new Promise<void>((resolve, reject) => {
    const child = launcher;
    if (!child?.connected) {
      reject(new Error('The daemon launcher is unavailable.'));
      return;
    }
    const request = ++requestId;
    const cleanup = () => {
      clearTimeout(timer);
      child.off('message', receive);
      child.off('exit', exited);
    };
    const receive = (message: unknown) => {
      if (
        !message ||
        typeof message !== 'object' ||
        !('request' in message) ||
        message.request !== request
      )
        return;
      cleanup();
      if ('ok' in message && message.ok === true) resolve();
      else reject(new Error('error' in message ? String(message.error) : 'Daemon handoff failed.'));
    };
    const exited = () => {
      cleanup();
      reject(new Error('The daemon launcher exited.'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Daemon handoff timed out.'));
    }, 65_000);
    child.on('message', receive);
    child.once('exit', exited);
    child.send({ action, request, version }, (error) => {
      if (error) {
        cleanup();
        reject(error);
      }
    });
  });
}
