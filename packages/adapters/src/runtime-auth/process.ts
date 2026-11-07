import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { cliEnvironment } from '../process/environment.ts';
import { terminateCli } from '../process/launch.ts';
import { runtimeCommand } from '../process/executable.ts';
import type { NativeSignInOptions } from './types.ts';

/** Native sign-in only. Output is bounded, processed in memory and never retained in diagnostics. */
export const signInChild = (
  args: string[],
  options: NativeSignInOptions,
  explicitCompletion = false,
) => {
  options.signal.throwIfAborted();
  const command = runtimeCommand(options.command, [...(options.prefix ?? []), ...args]);
  const child = spawn(command.file, command.args, {
    cwd: tmpdir(),
    env: cliEnvironment({
      ...options.env,
      DISABLE_AUTOUPDATER: '1',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    }),
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let finished = false,
    succeeded = false,
    bytes = 0;
  let failure: Error | undefined;
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  let abortHandler = () => {};
  const stop = (error?: Error, success = false) => {
    if (finished) return;
    finished = true;
    succeeded = success;
    failure = error;
    child.stdin.end();
    terminateCli(child);
    forceTimer = setTimeout(() => child.kill('SIGKILL'), 1500);
    forceTimer.unref();
  };
  const abort = () => {
    abortHandler();
    stop(new Error('Sign-in was cancelled.'));
  };
  const timer = setTimeout(
    () => stop(new Error('Sign-in expired. Start again to get a new link.')),
    options.timeout ?? 5 * 60_000,
  );
  options.signal.addEventListener('abort', abort, { once: true });
  const cleanup = () => {
    clearTimeout(timer);
    clearTimeout(forceTimer);
    options.signal.removeEventListener('abort', abort);
  };
  const completion = new Promise<void>((resolve, reject) => {
    child.once('error', () => {
      failure ??= new Error('Could not start native sign-in. Recheck the runtime installation.');
    });
    child.once('close', (code) => {
      cleanup();
      if (failure) reject(failure);
      else if (succeeded || (!explicitCompletion && !finished && code === 0)) resolve();
      else reject(new Error('Native sign-in did not complete. Retry or use the CLI instructions.'));
    });
  });
  const receive = (stream: typeof child.stdout, listener: (text: string) => void) => {
    stream.setEncoding('utf8');
    stream.on('data', (text: string) => {
      if (finished) return;
      bytes += Buffer.byteLength(text);
      if (bytes > 256_000) {
        stop(new Error('Sign-in output exceeded its limit.'));
        return;
      }
      try {
        listener(text);
      } catch {
        stop(new Error('The runtime returned an unsupported sign-in response.'));
      }
    });
  };
  child.stdin.on('error', () => {});
  return {
    completion,
    receive,
    stdout: child.stdout,
    stderr: child.stderr,
    fail: (message: string) => stop(new Error(message)),
    succeed: () => stop(undefined, true),
    onAbort: (handler: () => void) => {
      abortHandler = handler;
    },
    write: (text: string) => {
      if (!finished && !child.stdin.destroyed) child.stdin.write(text);
    },
  };
};
