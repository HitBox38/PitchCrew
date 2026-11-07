import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { startSignInTerminal } from '../src/process/sign-in-terminal.ts';
import { terminalRedactor } from '../src/process/sign-in-terminal-redaction.ts';

const fixture = fileURLToPath(new URL('./fixtures/sign-in-terminal.mjs', import.meta.url));
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

it('runs a real owned PTY, accepts bounded input and resizes its actual terminal', async () => {
  let output = '';
  let markReady!: () => void, markSize!: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  const size = new Promise<void>((resolve) => {
    markSize = resolve;
  });
  const terminal = startSignInTerminal({
    command: process.execPath,
    args: [fixture, 'wait'],
    signal: new AbortController().signal,
    onOutput: (text) => {
      output += text;
      if (output.includes('READY:')) markReady();
      if (output.includes('SIZE:120:40')) markSize();
    },
  });
  await ready;
  expect(output).toContain('TTY=true');
  terminal.resize(120, 40);
  terminal.write('size\r');
  await size;
  terminal.write('finish\r');
  await terminal.completion;
  expect(output).toContain('FINISHED');
  expect(terminal.transcript()).toContain('FINISHED');
});

it('cancels the owned terminal before its completion releases the caller', async () => {
  const controller = new AbortController();
  let pid = 0,
    markReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  const terminal = startSignInTerminal({
    command: process.execPath,
    args: [fixture, 'wait'],
    signal: controller.signal,
    onOutput: (text) => {
      const match = text.match(/READY:(\d+)/);
      if (match) {
        pid = Number(match[1]);
        markReady();
      }
    },
  });
  const completed = expect(terminal.completion).rejects.toThrow('cancelled');
  await ready;
  expect(alive(pid)).toBe(true);
  controller.abort();
  await completed;
  expect(alive(pid)).toBe(false);
});

it('bounds native output and retained transcript, and rejects unsuccessful exits', async () => {
  const terminal = startSignInTerminal({
    command: process.execPath,
    args: [fixture, 'overflow'],
    signal: new AbortController().signal,
    onOutput: () => {},
  });
  await expect(terminal.completion).rejects.toThrow('output exceeded');
  expect(terminal.transcript().length).toBeLessThanOrEqual(16_000);
  const failed = startSignInTerminal({
    command: process.execPath,
    args: [fixture, 'fail'],
    signal: new AbortController().signal,
    onOutput: () => {},
  });
  await expect(failed.completion).rejects.toThrow('did not complete');
});

it('ends expired attempts without accepting later input', async () => {
  const terminal = startSignInTerminal({
    command: process.execPath,
    args: [fixture, 'wait'],
    signal: new AbortController().signal,
    timeout: 500,
    onOutput: () => {},
  });
  await expect(terminal.completion).rejects.toThrow('expired');
  expect(() => terminal.write('later\r')).toThrow('no longer active');
});

it('rejects excessive terminal input and never turns it into an argument or shell command', async () => {
  const terminal = startSignInTerminal({
    command: process.execPath,
    args: [fixture, 'wait'],
    signal: new AbortController().signal,
    onOutput: () => {},
  });
  const completed = expect(terminal.completion).rejects.toThrow('input exceeded');
  expect(() => terminal.write('x'.repeat(4097))).toThrow('input exceeded');
  await completed;
});

it('terminates its PTY when the owning helper client disconnects', async () => {
  const owner = fork(
    fileURLToPath(new URL('./fixtures/sign-in-terminal-owner.mjs', import.meta.url)),
    [fixture],
    {
      execArgv: ['--import', import.meta.resolve('tsx')],
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    },
  );
  const pid = await new Promise<number>((resolve, reject) => {
    owner.once('error', reject);
    owner.once('message', (message: { pid: number }) => resolve(message.pid));
  });
  await new Promise<void>((resolve) => owner.once('close', () => resolve()));
  await expect.poll(() => alive(pid)).toBe(false);
});

it('redacts configured secrets across chunk boundaries and strips terminal control actions', () => {
  const redact = terminalRedactor({ FIXTURE_API_KEY: 'fictional-secret-value', NORMAL: 'visible' });
  expect(redact('hello fictional-sec')).toBe('hello ');
  expect(redact('ret-value\n')).toBe('[redacted]\n');
  expect(redact('\u001b]52;c;clipboard\u0007\u001b[31mvisible\u001b[0m')).toBe(
    '\u001b[31mvisible\u001b[0m',
  );
  expect(redact('fictional-sec', true)).toBe('[redacted]');
});

it('redacts short allowlisted credentials while retaining short non-secret authentication switches', () => {
  const redact = terminalRedactor({ CODEX_API_KEY: 'abc', FIXTURE_AUTH_SWITCH: '1' });
  expect(redact('ready a')).toBe('ready ');
  expect(redact('\u001b[31mbc 1', true)).toBe('[redacted] 1');
});

it('filters split OSC/DCS side channels while preserving actual VT presentation', () => {
  const text =
    '\u001b[31mready\u001b]52;c;clipboard\u0007\u001b]0;title\u0007' +
    '\u001b]8;;https://fixture.invalid\u001b\\label\u001b]8;;\u001b\\' +
    '\u001bPdiscarded-device-payload\u001b\\\u001b[0m';
  for (let split = 0; split <= text.length; split++) {
    const redact = terminalRedactor({});
    expect(redact(text.slice(0, split)) + redact(text.slice(split), true)).toBe(
      '\u001b[31mreadylabel\u001b[0m',
    );
  }
  const coloredSecret = terminalRedactor({ FIXTURE_API_KEY: 'fictional-secret-value' });
  expect(coloredSecret('fictional-\u001b[31msec')).toBe('');
  expect(coloredSecret('ret-\u001b[0mvalue', true)).toBe('[redacted]');
});
