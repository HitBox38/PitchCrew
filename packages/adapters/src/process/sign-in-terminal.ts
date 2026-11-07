import { fork } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { nodeExecutable } from '@pitchcrew/core/isolated-worker';
import { cliEnvironment } from './environment.ts';
import { runtimeCommand } from './executable.ts';
import { terminateCli } from './launch.ts';
import { terminalRedactor } from './sign-in-terminal-redaction.ts';
import {
  terminalOutputLimit,
  terminalTranscriptLimit,
  type SignInTerminalFailure,
  type SignInTerminalInput,
  type SignInTerminalOutput,
} from './sign-in-terminal-protocol.ts';

export interface SignInTerminalOptions {
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
  cwd?: string;
  signal: AbortSignal;
  onOutput: (text: string) => void;
  timeout?: number;
}

const failureMessages: Record<SignInTerminalFailure, string> = {
  start: 'Could not start native sign-in. Recheck the runtime installation.',
  cancelled: 'Sign-in was cancelled.',
  expired: 'Sign-in expired. Start again to get a new link.',
  output: 'Sign-in output exceeded its limit.',
  input: 'Sign-in input exceeded its limit.',
};

/** Fixed authentication commands only. The helper runs genuine Node and owns the real PTY. */
export const startSignInTerminal = (options: SignInTerminalOptions) => {
  options.signal.throwIfAborted();
  const command = runtimeCommand(options.command, options.args);
  const environment = cliEnvironment(options.env);
  const helperEnvironment = { ...process.env };
  delete helperEnvironment.WATCH_REPORT_DEPENDENCIES;
  delete helperEnvironment.NODE_OPTIONS;
  const worker = fork(fileURLToPath(new URL('./sign-in-terminal-worker.ts', import.meta.url)), [], {
    execPath: nodeExecutable(),
    execArgv: ['--max-old-space-size=96', '--import', import.meta.resolve('tsx')],
    env: helperEnvironment,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  const timeout = Math.min(5 * 60_000, Math.max(1, options.timeout ?? 5 * 60_000));
  const redact = terminalRedactor(environment);
  let transcript = '',
    bytes = 0,
    inputBytes = 0,
    ready = false,
    result = false;
  let error: Error | undefined, force: ReturnType<typeof setTimeout> | undefined;
  const queue: SignInTerminalInput[] = [];
  const send = (message: SignInTerminalInput) => {
    if (worker.connected) worker.send(message, () => {});
  };
  const stop = (failure: SignInTerminalFailure) => {
    if (error || result) return;
    error = new Error(failureMessages[failure]);
    send({ action: 'cancel' });
    force = setTimeout(() => terminateCli(worker), 1800);
    force.unref();
  };
  const abort = () => stop('cancelled');
  const timer = setTimeout(() => stop('expired'), timeout);
  options.signal.addEventListener('abort', abort, { once: true });
  const completion = new Promise<void>((resolve, reject) => {
    worker.once('spawn', () => {
      if (error || options.signal.aborted) {
        terminateCli(worker);
        return;
      }
      send({
        action: 'start',
        command: command.file,
        args: command.args,
        cwd: options.cwd ?? tmpdir(),
        env: environment,
        timeout,
      });
    });
    worker.on('message', (message: SignInTerminalOutput) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') {
        ready = true;
        for (const pending of queue.splice(0)) send(pending);
      } else if (
        message.type === 'output' &&
        !error &&
        !result &&
        typeof message.data === 'string'
      ) {
        bytes += Buffer.byteLength(message.data);
        if (bytes > terminalOutputLimit) {
          stop('output');
          return;
        }
        const text = redact(message.data);
        transcript = (transcript + text).slice(-terminalTranscriptLimit);
        try {
          if (text) options.onOutput(text);
        } catch {
          stop('start');
        }
      } else if (message.type === 'done') {
        result = true;
        if (message.failure && Object.hasOwn(failureMessages, message.failure))
          error ??= new Error(failureMessages[message.failure]);
        else if (message.code !== 0)
          error ??= new Error(
            'Native sign-in did not complete. Retry or use the CLI instructions.',
          );
      }
    });
    worker.once('error', () => {
      error ??= new Error(failureMessages.start);
    });
    worker.once('close', () => {
      clearTimeout(timer);
      clearTimeout(force);
      options.signal.removeEventListener('abort', abort);
      queue.length = 0;
      const tail = redact('', true);
      transcript = (transcript + tail).slice(-terminalTranscriptLimit);
      try {
        if (tail) options.onOutput(tail);
      } catch {
        error ??= new Error(failureMessages.start);
      }
      if (error || !result) reject(error ?? new Error(failureMessages.start));
      else resolve();
    });
  });
  return {
    completion,
    transcript: () => transcript,
    write: (data: string) => {
      if (error || result) throw new Error('This sign-in terminal is no longer active.');
      if (
        typeof data !== 'string' ||
        Buffer.byteLength(data) > 4096 ||
        inputBytes + Buffer.byteLength(data) > 64_000
      ) {
        stop('input');
        throw new Error(failureMessages.input);
      }
      inputBytes += Buffer.byteLength(data);
      const message: SignInTerminalInput = { action: 'write', data };
      if (ready) send(message);
      else queue.push(message);
    },
    resize: (cols: number, rows: number) => {
      if (
        !Number.isInteger(cols) ||
        !Number.isInteger(rows) ||
        cols < 1 ||
        cols > 500 ||
        rows < 1 ||
        rows > 200
      )
        throw new Error('Choose a terminal size between 1–500 columns and 1–200 rows.');
      if (ready && !error && !result) send({ action: 'resize', cols, rows });
    },
  };
};
