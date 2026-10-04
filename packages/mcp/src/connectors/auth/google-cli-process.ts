import { spawn } from 'node:child_process';
import { lstat, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { maxBytes } from './helpers.ts';
import { googleCliExecutable } from './google-cli-executable.ts';

export type GoogleCliRunner = (
  args: readonly string[],
  signal: AbortSignal,
  download?: boolean,
) => Promise<{ stdout: string; exitCode: number; text?: string; mimeType?: string }>;
export class GoogleCliMissingError extends Error {
  constructor() {
    super('Install Google Workspace CLI (gws), then try connecting again.');
  }
}
const tooLarge = () =>
  new Error('Connector response is too large. Narrow the query or select a smaller file.');

export function createGoogleCliRunner(
  command?: string,
  prefix: readonly string[] = [],
): GoogleCliRunner {
  return async (args, signal, download = false) => {
    signal.throwIfAborted();
    const executable = command ?? (await googleCliExecutable());
    if (!executable) throw new GoogleCliMissingError();
    const folder = await mkdtemp(join(tmpdir(), 'pitchcrew-gws-'));
    const output = join(folder, 'response');
    try {
      const apiRequest = args[0] !== 'auth' && args[0] !== '--version';
      const result = await execute(
        executable,
        prefix,
        args,
        signal,
        folder,
        apiRequest ? output : undefined,
      );
      signal.throwIfAborted();
      if (!apiRequest || result.exitCode !== 0) return result;
      const stats = await lstat(output).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return undefined;
        throw new Error('Cannot read the Google Workspace CLI download.');
      });
      if (!stats) {
        if (!download) return result;
        // gws prints JSON media to stdout rather than a file, preserving the
        // parsed content but normalizing JSON whitespace through its formatter.
        try {
          JSON.parse(result.stdout);
        } catch {
          throw new Error('Google Workspace CLI returned an unsupported download response.');
        }
        return { ...result, text: result.stdout, mimeType: 'application/json' };
      }
      if (!download) throw new Error('Google Workspace CLI returned an unsupported read response.');
      let metadata: Record<string, unknown>;
      try {
        metadata = JSON.parse(result.stdout) as Record<string, unknown>;
      } catch {
        throw new Error('Google Workspace CLI returned an unsupported download response.');
      }
      if (
        metadata.status !== 'success' ||
        metadata.saved_file !== output ||
        typeof metadata.mimeType !== 'string'
      )
        throw new Error('Google Workspace CLI returned an unsupported download response.');
      if (!/^(text\/[^;\s]+|application\/(json|csv))(?:;|$)/i.test(metadata.mimeType))
        throw new Error(
          'This file is not supported text. Use a text/Markdown/CSV file or the Google Docs tool.',
        );
      if (!stats.isFile() || stats.isSymbolicLink())
        throw new Error('Google Workspace CLI returned an unsupported download response.');
      if (stats.size > maxBytes) throw tooLarge();
      const bytes = await readFile(output);
      if (bytes.length > maxBytes) throw tooLarge();
      signal.throwIfAborted();
      return { ...result, text: bytes.toString('utf8'), mimeType: metadata.mimeType };
    } finally {
      if (resolve(folder).startsWith(resolve(tmpdir(), 'pitchcrew-gws-')))
        await rm(folder, { recursive: true, force: true });
    }
  };
}

function execute(
  command: string,
  prefix: readonly string[],
  args: readonly string[],
  signal: AbortSignal,
  folder: string,
  output?: string,
) {
  return new Promise<{ stdout: string; exitCode: number }>((resolveResult, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
    // auth status reports the saved OAuth account. Ignore alternate credential
    // sources so subsequent reads use that same account, rather than an override.
    for (const key of [
      'GOOGLE_WORKSPACE_CLI_TOKEN',
      'GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE',
      'GOOGLE_APPLICATION_CREDENTIALS',
      'RUST_LOG',
      'RUST_BACKTRACE',
    ])
      delete env[key];
    const child = spawn(command, [...prefix, ...args, ...(output ? ['--output', output] : [])], {
      cwd: folder,
      env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let failure: Error | undefined;
    const fail = (error: Error) => {
      failure ??= error;
      child.kill();
    };
    const consume = (chunk: Buffer, keep: boolean) => {
      bytes += chunk.length;
      if (bytes > maxBytes) fail(tooLarge());
      else if (keep && !failure) chunks.push(chunk);
    };
    child.stdout.on('data', (chunk: Buffer) => consume(chunk, true));
    child.stderr.on('data', (chunk: Buffer) => consume(chunk, false));
    // gws streams non-JSON API responses to disk. Bound that temporary download
    // as well as stdout/stderr, and wait for process exit before cleaning up.
    const monitor = output
      ? setInterval(() => {
          void lstat(output)
            .then((stats) => {
              if (stats.size > maxBytes) fail(tooLarge());
            })
            .catch(() => {});
        }, 25)
      : undefined;
    child.once('error', (error: NodeJS.ErrnoException) => {
      failure ??=
        error.code === 'ENOENT'
          ? new GoogleCliMissingError()
          : new Error(
              signal.aborted
                ? 'Connector request cancelled.'
                : 'Google Workspace CLI request failed or timed out. Try again.',
            );
    });
    child.once('close', (code) => {
      clearInterval(monitor);
      if (signal.aborted) reject(new Error('Connector request cancelled.'));
      else if (failure) reject(failure);
      else resolveResult({ stdout: Buffer.concat(chunks).toString('utf8'), exitCode: code ?? 1 });
    });
  });
}
