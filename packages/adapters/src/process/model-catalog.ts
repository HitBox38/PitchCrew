import type { RuntimeModel } from '@pitchcrew/core';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { modelDiscoveryMaxBytes, modelDiscoveryTimeout } from '../model-discovery.ts';
import { cliEnvironment } from './environment.ts';
import { runtimeCommand } from './executable.ts';
import { terminateCli } from './launch.ts';

type Message = Record<string, unknown>;
type Send = (message: Message) => void;
// A completed catalog ends decoding, including any remaining messages in the same chunk.
type Receive = (event: unknown) => boolean;

const jsonLines = (receive: Receive) => {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk;
    let end: number;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      let event: unknown;
      try {
        event = JSON.parse(line);
      } catch {
        continue; // These CLIs can print plain-text startup diagnostics.
      }
      if (receive(event)) return;
    }
  };
};

const contentLengthFrames = (receive: Receive) => {
  let buffer: Buffer = Buffer.alloc(0);
  return (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const end = buffer.indexOf('\r\n\r\n');
      if (end < 0) return;
      const header = buffer.subarray(0, end).toString('ascii');
      const match = header.match(/(?:^|\r\n)Content-Length:\s*(\d+)\s*(?:\r\n|$)/i);
      const length = match ? Number(match[1]) : 0;
      if (!length || length > modelDiscoveryMaxBytes) throw new Error('Invalid response framing.');
      if (buffer.length < end + 4 + length) return;
      const body = buffer.subarray(end + 4, end + 4 + length).toString('utf8');
      buffer = buffer.subarray(end + 4 + length);
      if (receive(JSON.parse(body))) return;
    }
  };
};

interface ModelCatalogOptions<Event> {
  name: string;
  wire: 'json-lines' | 'framed-json-rpc';
  countStderr?: boolean;
  signal?: AbortSignal;
  timeout?: number;
  initialRequest: Message;
  /** Return the catalog to finish. Otherwise keep reading, optionally sending the next request. */
  receive: (event: Event, send: Send) => RuntimeModel[] | void;
}

export const readModelCatalog = async <Event>(
  command: string,
  args: string[],
  options: ModelCatalogOptions<Event>,
): Promise<RuntimeModel[]> => {
  const { name, wire, signal, timeout = modelDiscoveryTimeout } = options;
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const invocation = runtimeCommand(command, args);
    const child = spawn(invocation.file, invocation.args, {
      cwd: tmpdir(),
      env: cliEnvironment(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let outcome: Error | RuntimeModel[] | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let bytes = 0;
    const stop = (result: Error | RuntimeModel[]) => {
      if (outcome) return;
      outcome = result;
      child.stdin.end();
      terminateCli(child);
      killTimer = setTimeout(() => child.kill('SIGKILL'), 500);
      killTimer.unref();
    };
    const abort = () => stop(new Error('Model discovery cancelled.'));
    const timer = setTimeout(() => stop(new Error('Model discovery timed out.')), timeout);
    signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', abort);
    };
    const send: Send = (message) => {
      if (outcome || child.stdin.destroyed) return;
      if (wire === 'framed-json-rpc') {
        const body = JSON.stringify({ jsonrpc: '2.0', ...message });
        child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
      } else child.stdin.write(JSON.stringify(message) + '\n');
    };
    const receive: Receive = (event) => {
      const models = options.receive(event as Event, send);
      if (models === undefined) return false;
      stop(models);
      return true;
    };
    const countBytes = (chunk: string | Buffer) => {
      if (outcome) return false;
      bytes += Buffer.byteLength(chunk);
      if (bytes <= modelDiscoveryMaxBytes) return true;
      stop(new Error('Model discovery output exceeded its limit.'));
      return false;
    };
    const onData =
      <T extends string | Buffer>(decode: (chunk: T) => void) =>
      (chunk: T) => {
        if (!countBytes(chunk)) return;
        try {
          decode(chunk);
        } catch {
          stop(new Error(`Could not read the ${name} model catalog.`));
        }
      };
    if (wire === 'framed-json-rpc') child.stdout.on('data', onData(contentLengthFrames(receive)));
    else child.stdout.setEncoding('utf8').on('data', onData(jsonLines(receive)));
    if (options.countStderr) child.stderr.on('data', countBytes);
    else child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('error', () => {
      cleanup();
      outcome = new Error(`Could not start ${name} model discovery.`);
      reject(outcome);
    });
    child.once('close', () => {
      cleanup();
      if (outcome instanceof Error) reject(outcome);
      else if (outcome) resolve(outcome);
      else reject(new Error(`${name} exited before returning its models.`));
    });
    send(options.initialRequest);
  });
};
