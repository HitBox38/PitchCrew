import * as pty from 'node-pty';
import {
  terminalOutputLimit,
  type SignInTerminalFailure,
  type SignInTerminalInput,
  type SignInTerminalOutput,
} from './sign-in-terminal-protocol.ts';

// node-pty's Windows workers/forks must not inherit tsx or Node watch IPC protocols.
process.execArgv.length = 0;
delete process.env.WATCH_REPORT_DEPENDENCIES;
let terminal: pty.IPty | undefined;
let started = false,
  done = false,
  bytes = 0,
  inputBytes = 0;
let failure: SignInTerminalFailure | undefined;
let timer: ReturnType<typeof setTimeout> | undefined,
  force: ReturnType<typeof setTimeout> | undefined;
const send = (message: SignInTerminalOutput) => {
  if (process.connected) process.send?.(message, () => {});
};
const finish = (code: number | null) => {
  if (done) return;
  done = true;
  clearTimeout(timer);
  clearTimeout(force);
  const message: SignInTerminalOutput = { type: 'done', code, ...(failure ? { failure } : {}) };
  if (process.connected) process.send?.(message, () => process.exit(0));
  else process.exit(0);
};
const stop = (reason: SignInTerminalFailure) => {
  if (done || failure) return;
  failure = reason;
  if (!terminal) {
    finish(null);
    return;
  }
  try {
    terminal.kill();
  } catch {
    /* The owned PTY can already have exited. */
  }
  force = setTimeout(() => {
    try {
      if (process.platform !== 'win32') terminal?.kill('SIGKILL');
      else terminal?.kill();
    } catch {
      /* Closing the helper releases its owned pseudoconsole. */
    }
    finish(null);
  }, 1200);
};
process.on('disconnect', () => stop('cancelled'));
process.on('SIGTERM', () => stop('cancelled'));
process.on('SIGINT', () => stop('cancelled'));
process.on('message', (message: SignInTerminalInput) => {
  if (!message || typeof message !== 'object' || done) return;
  if (message.action === 'cancel') {
    stop('cancelled');
    return;
  }
  if (message.action === 'start' && !started) {
    started = true;
    try {
      if (
        !message.command ||
        message.command.includes('\0') ||
        !Array.isArray(message.args) ||
        message.args.length > 128 ||
        message.args.some(
          (argument) =>
            typeof argument !== 'string' || argument.includes('\0') || argument.length > 16_384,
        )
      )
        throw new Error('Invalid authentication command.');
      const env: NodeJS.ProcessEnv = {
        ...message.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      };
      delete env.WATCH_REPORT_DEPENDENCIES;
      terminal = pty.spawn(message.command, message.args, {
        cwd: message.cwd,
        env,
        name: 'xterm-256color',
        cols: 100,
        rows: 28,
        useConptyDll: true,
      });
      terminal.onData((data) => {
        if (done || failure) return;
        bytes += Buffer.byteLength(data);
        if (bytes > terminalOutputLimit) {
          stop('output');
          return;
        }
        send({ type: 'output', data });
      });
      terminal.onExit(({ exitCode }) => finish(exitCode));
      timer = setTimeout(() => stop('expired'), Math.min(300_000, Math.max(1, message.timeout)));
      send({ type: 'ready' });
    } catch {
      failure = 'start';
      finish(null);
    }
  } else if (message.action === 'write' && terminal && !failure) {
    if (
      typeof message.data !== 'string' ||
      Buffer.byteLength(message.data) > 4096 ||
      inputBytes + Buffer.byteLength(message.data) > 64_000
    ) {
      stop('input');
      return;
    }
    inputBytes += Buffer.byteLength(message.data);
    try {
      terminal.write(message.data);
    } catch {
      stop('start');
    }
  } else if (message.action === 'resize' && terminal && !failure) {
    if (
      !Number.isInteger(message.cols) ||
      !Number.isInteger(message.rows) ||
      message.cols < 1 ||
      message.cols > 500 ||
      message.rows < 1 ||
      message.rows > 200
    )
      return;
    try {
      terminal.resize(message.cols, message.rows);
    } catch {
      stop('start');
    }
  }
});
