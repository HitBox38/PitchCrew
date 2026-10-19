import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { MaintenanceCommand } from '@pitchcrew/adapters';

/** Keep update execution alive across renderer disconnects, but owned by the daemon. */
export function runRuntimeInstaller(
  command: MaintenanceCommand,
  options: {
    lockKey: string;
    signal?: AbortSignal;
    timeout?: number;
    onOutput?: (text: string) => void;
    onSpawn?: (pid: number) => void;
  },
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  if (options.signal?.aborted)
    return Promise.reject(new Error('Runtime maintenance was interrupted.'));
  return new Promise((resolve, reject) => {
    const worker = fork(fileURLToPath(new URL('./installer-worker.ts', import.meta.url)), [], {
      execArgv: ['--import', import.meta.resolve('tsx')],
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let code: number | null | undefined;
    let error: string | undefined;
    const cancel = () => {
      if (worker.connected) worker.send({ action: 'cancel' });
    };
    const timer = setTimeout(cancel, (options.timeout ?? 600_000) + 5000);
    options.signal?.addEventListener('abort', cancel, { once: true });
    worker.once('spawn', () => {
      if (worker.pid) options.onSpawn?.(worker.pid);
      worker.send({ action: 'run', command, lockKey: options.lockKey, timeout: options.timeout });
      if (options.signal?.aborted) cancel();
    });
    worker.on('message', (message: { output?: unknown; error?: unknown; code?: unknown }) => {
      if (typeof message.output === 'string') options.onOutput?.(message.output);
      if (typeof message.error === 'string') error = message.error;
      if (message.code === null || typeof message.code === 'number') code = message.code;
    });
    worker.once('error', () => {
      error = 'Could not start the runtime installer worker.';
    });
    worker.once('exit', () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      if (error || code === undefined)
        reject(new Error(error ?? 'Runtime installer was interrupted.'));
      else resolve({ code, stdout: '', stderr: '' });
    });
  });
}
