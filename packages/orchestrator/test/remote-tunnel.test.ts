import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter, getEventListeners } from 'node:events';
import { access, mkdtemp, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { findTunnelExecutable, openRemoteTunnel } from '../src/remote-mcp/tunnel.ts';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

const folders: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.mocked(spawn).mockReset();
  for (const directory of folders.splice(0)) {
    expect(dirname(directory)).toBe(resolve(tmpdir()));
    expect(directory.split(/[\\/]/).at(-1)).toMatch(/^pitchcrew-tunnel-test-/);
    await rm(directory, { recursive: true, force: true });
  }
});

const fixture = () => {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    kill: vi.fn((signal: NodeJS.Signals = 'SIGTERM') => {
      child.signalCode = signal;
      queueMicrotask(() => child.emit('close', null, signal));
      return true;
    }),
  });
  let started!: () => void;
  const spawned = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.mocked(spawn).mockImplementation(() => {
    started();
    return child as unknown as ChildProcess;
  });
  const controller = new AbortController();
  const pending = openRemoteTunnel(
    new URL('http://127.0.0.1:14582'),
    controller.signal,
    process.execPath,
  );
  return { child, controller, pending, spawned };
};

it('discovers only a native executable from PATH without launching it', async () => {
  const directory = resolve(await mkdtemp(join(tmpdir(), 'pitchcrew-tunnel-test-')));
  folders.push(directory);
  const file = join(directory, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  await writeFile(file, 'fixture');
  await chmod(file, 0o700);
  vi.stubEnv('PATH', directory);
  expect(await findTunnelExecutable()).toBe(file);
  expect(spawn).not.toHaveBeenCalled();
  vi.stubEnv('PATH', '');
  expect(await findTunnelExecutable()).toBeNull();
});

it('accepts only a complete exact tunnel origin and isolates configuration, environment and shutdown', async () => {
  vi.stubEnv('TUNNEL_URL', 'https://must-not-inherit.invalid');
  vi.stubEnv('XAI_API_KEY', 'must-not-inherit');
  const { child, controller, pending, spawned } = fixture();
  await spawned;
  const [, args, options] = vi.mocked(spawn).mock.calls[0];
  const arguments_ = args as string[];
  const config = arguments_[arguments_.indexOf('--config') + 1];
  expect(await readFile(config, 'utf8')).toBe('{}\n');
  expect(arguments_).toContain('--no-autoupdate');
  expect(arguments_[arguments_.indexOf('--url') + 1]).toBe('http://127.0.0.1:14582/');
  expect(options).toMatchObject({ shell: false, windowsHide: true });
  expect((options as { env: NodeJS.ProcessEnv }).env).not.toHaveProperty('TUNNEL_URL');
  expect((options as { env: NodeJS.ProcessEnv }).env).not.toHaveProperty('XAI_API_KEY');
  child.stderr.write(
    'https://good.trycloudflare.com.evil.invalid\nhttps://bad.trycloudflare.com/path\n',
  );
  child.stdout.write('| https://actual-');
  child.stdout.write('origin.trycloudflare.com |\n');
  const tunnel = await pending;
  expect(tunnel.origin.href).toBe('https://actual-origin.trycloudflare.com/');
  await Promise.all([tunnel.close(), tunnel.close()]);
  await tunnel.closed;
  expect(child.kill).toHaveBeenCalledTimes(1);
  await expect(access(dirname(config))).rejects.toThrow();
  expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
  expect(child.stdout.listenerCount('data')).toBe(0);
  expect(child.stderr.listenerCount('data')).toBe(0);
  expect(child.listenerCount('error')).toBe(0);
});

it('does not spawn for unsafe targets or an already aborted request', async () => {
  for (const target of [
    'https://127.0.0.1:14582',
    'http://localhost:14582',
    'http://127.0.0.1:80',
    'http://user@127.0.0.1:14582',
    'http://127.0.0.1:14582/api',
    'http://127.0.0.1:14582/?',
    'http://127.0.0.1:14582/#',
  ]) {
    await expect(
      openRemoteTunnel(new URL(target), new AbortController().signal, process.execPath),
    ).rejects.toThrow('loopback');
  }
  await expect(
    openRemoteTunnel(new URL('http://127.0.0.1:14582'), AbortSignal.abort(), process.execPath),
  ).rejects.toThrow();
  expect(spawn).not.toHaveBeenCalled();
});

it('cancels startup and also closes an already ready tunnel when its owner aborts', async () => {
  const first = fixture();
  await first.spawned;
  const rejected = expect(first.pending).rejects.toThrow('cancelled');
  first.controller.abort();
  await rejected;
  expect(first.child.kill).toHaveBeenCalledOnce();
  const second = fixture();
  await second.spawned;
  second.child.stderr.write('https://second.trycloudflare.com\n');
  const tunnel = await second.pending;
  second.controller.abort();
  await tunnel.closed;
  expect(second.child.kill).toHaveBeenCalledOnce();
});

it('bounds startup time and output without leaking process diagnostics', async () => {
  vi.useFakeTimers();
  const timed = fixture();
  await timed.spawned;
  const timeout = expect(timed.pending).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(45_000);
  await timeout;
  expect(timed.child.kill).toHaveBeenCalledOnce();
  const noisy = fixture();
  await noisy.spawned;
  const overflow = expect(noisy.pending).rejects.toThrow('oversized');
  noisy.child.stderr.write('private diagnostics '.repeat(300));
  await overflow;
  expect(noisy.child.kill).toHaveBeenCalledOnce();
  const flooded = fixture();
  await flooded.spawned;
  const flood = expect(flooded.pending).rejects.toThrow('too much output');
  flooded.child.stderr.write('private\n'.repeat(5000));
  await flood;
  expect(flooded.child.kill).toHaveBeenCalledOnce();
});

it('escalates shutdown if the process does not respond to its graceful signal', async () => {
  vi.useFakeTimers();
  const { child, pending, spawned } = fixture();
  child.kill.mockImplementation((signal: NodeJS.Signals = 'SIGTERM') => {
    if (signal === 'SIGKILL') {
      child.signalCode = signal;
      queueMicrotask(() => child.emit('close', null, signal));
    }
    return true;
  });
  await spawned;
  child.stdout.write('https://shutdown.trycloudflare.com\n');
  const tunnel = await pending;
  const closing = tunnel.close();
  await vi.advanceTimersByTimeAsync(2000);
  await closing;
  expect(child.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
});

it('reports early process failure and lets the owner observe an unexpected exit after readiness', async () => {
  const unavailable = fixture();
  await unavailable.spawned;
  const failed = expect(unavailable.pending).rejects.toThrow('Could not start cloudflared');
  unavailable.child.emit('error', new Error('private process failure details'));
  await failed;
  const early = fixture();
  await early.spawned;
  const rejected = expect(early.pending).rejects.toThrow('stopped before');
  early.child.exitCode = 1;
  early.child.emit('close', 1, null);
  await rejected;
  const ready = fixture();
  await ready.spawned;
  ready.child.stderr.write('https://ready.trycloudflare.com\n');
  const tunnel = await ready.pending;
  ready.child.exitCode = 1;
  ready.child.emit('close', 1, null);
  await tunnel.closed;
  expect(ready.child.kill).not.toHaveBeenCalled();
});
