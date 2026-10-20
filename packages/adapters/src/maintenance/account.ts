import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { cliEnvironment } from '../process/environment.ts';
import { terminateCli } from '../process/launch.ts';

/** Account metadata only: no thread, session, model request or user turn is created. */
export const readCodexAccount = (
  command: string,
  signal?: AbortSignal,
  prefix: string[] = [],
): Promise<{ account: unknown; requiresOpenaiAuth: boolean }> => {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      [
        ...prefix,
        'app-server',
        '--listen',
        'stdio://',
        '--ignore-user-config',
        '-c',
        'features.apps=false',
        '-c',
        'features.hooks=false',
        '-c',
        'analytics.enabled=false',
      ],
      {
        cwd: tmpdir(),
        env: cliEnvironment(),
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    let buffer = '',
      bytes = 0,
      finished = false;
    let result: { account: unknown; requiresOpenaiAuth: boolean } | undefined;
    let failure: Error | undefined;
    const stop = (error?: Error) => {
      if (finished) return;
      finished = true;
      failure = error;
      child.stdin.end();
      terminateCli(child);
    };
    const abort = () => stop(new Error('Authentication check interrupted.'));
    const timer = setTimeout(() => stop(new Error('Authentication check timed out.')), 15_000);
    signal?.addEventListener('abort', abort, { once: true });
    const send = (data: unknown) => {
      if (!finished) child.stdin.write(JSON.stringify(data) + '\n');
    };
    const count = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 256_000) stop(new Error('Authentication response exceeded its limit.'));
    };
    child.stdout.on('data', (chunk: Buffer) => {
      count(chunk);
      buffer += chunk.toString('utf8');
      let end: number;
      while (!finished && (end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        try {
          const event = JSON.parse(line) as {
            id?: unknown;
            method?: unknown;
            error?: unknown;
            result?: { account?: unknown; requiresOpenaiAuth?: unknown };
          };
          if (event.method) {
            if (event.id !== undefined)
              send({ id: event.id, error: { code: -32601, message: 'Unsupported capability.' } });
            continue;
          }
          if (event.error) {
            stop(new Error('Account metadata unavailable.'));
            continue;
          }
          if (event.id === 1) {
            send({ method: 'initialized', params: {} });
            send({ id: 2, method: 'account/read', params: { refreshToken: false } });
          }
          if (event.id === 2 && typeof event.result?.requiresOpenaiAuth === 'boolean') {
            result = {
              account: event.result.account,
              requiresOpenaiAuth: event.result.requiresOpenaiAuth,
            };
            stop();
          }
        } catch {
          /* Ignore non-protocol startup lines; never retain them. */
        }
      }
    });
    child.stderr.on('data', count);
    child.stdin.on('error', () => {});
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    child.once('error', () => {
      cleanup();
      reject(new Error('Could not check Codex authentication.'));
    });
    child.once('close', () => {
      cleanup();
      if (result && !failure) resolve(result);
      else reject(failure ?? new Error('No account metadata returned.'));
    });
    send({
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: 'pitchcrew', version: '0.9.0' } },
    });
  });
};
