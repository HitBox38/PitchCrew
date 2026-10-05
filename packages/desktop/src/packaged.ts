import { fork, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

let launcher: ChildProcess | undefined;

export async function startPackagedDaemon(resources: string) {
  const runtime = join(resources, 'runtime');
  launcher = fork(join(runtime, 'scripts/packaged-launcher.mjs'), [], {
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
      resolve(message.url);
    });
  });
}

export function stopPackagedDaemon() {
  if (launcher?.connected) launcher.send('stop');
}
