import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { maxBytes } from './helpers.ts';

export type GithubCliRunner = (
  args: readonly string[],
  signal: AbortSignal,
) => Promise<{
  stdout: string;
  exitCode: number;
}>;
export class GithubCliMissingError extends Error {
  constructor() {
    super('Install GitHub CLI, then try connecting again.');
  }
}

export function createGithubCliRunner(
  command = 'gh',
  prefix: readonly string[] = [],
): GithubCliRunner {
  return (args, signal) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Connector request cancelled.'));
        return;
      }
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        GH_PROMPT_DISABLED: '1',
        GH_NO_UPDATE_NOTIFIER: '1',
        GH_NO_EXTENSION_UPDATE_NOTIFIER: '1',
        GH_PAGER: '',
        NO_COLOR: '1',
      };
      delete env.GH_DEBUG;
      const child = spawn(command, [...prefix, ...args], {
        cwd: tmpdir(),
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
      });
      const chunks: Buffer[] = [];
      let bytes = 0;
      const consume = (chunk: Buffer, keep: boolean) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          child.kill();
          reject(
            new Error(
              'Connector response is too large. Narrow the query or select a smaller file.',
            ),
          );
        } else if (keep) chunks.push(chunk);
      };
      child.stdout.on('data', (chunk: Buffer) => consume(chunk, true));
      child.stderr.on('data', (chunk: Buffer) => consume(chunk, false));
      child.once('error', (error: NodeJS.ErrnoException) =>
        reject(
          error.code === 'ENOENT'
            ? new GithubCliMissingError()
            : new Error(
                signal.aborted
                  ? 'Connector request cancelled.'
                  : 'GitHub CLI request failed or timed out. Try again.',
              ),
        ),
      );
      child.once('close', (code) => {
        if (signal.aborted) {
          reject(new Error('Connector request cancelled.'));
          return;
        }
        resolve({ stdout: Buffer.concat(chunks).toString('utf8'), exitCode: code ?? 1 });
      });
    });
}
