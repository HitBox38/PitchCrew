import type { RuntimeModel } from '@pitchcrew/core';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import {
  modelDiscoveryMaxBytes,
  modelDiscoveryTimeout,
  normalizeModels,
} from '../model-discovery.ts';
import { cliEnvironment, terminateCli } from '../process.ts';

// Native Copilot SDK transport: Content-Length framed JSON-RPC, with no session.create/send.
// https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts
export const copilotModelArgs = ['--headless', '--stdio', '--no-auto-update'];

export function parseCopilotModels(result: unknown): RuntimeModel[] {
  const output = result as { models?: unknown } | undefined;
  if (!output || !Array.isArray(output.models)) throw new Error('Invalid Copilot model catalog.');
  return normalizeModels(
    output.models.flatMap((row: { id?: unknown; name?: unknown; policy?: { state?: unknown } }) => {
      if (!row || typeof row.id !== 'string' || typeof row.name !== 'string')
        throw new Error('Invalid Copilot model row.');
      if (row.policy?.state === 'disabled') return [];
      return [{ value: row.id, label: row.name }];
    }),
  );
}

export async function readCopilotModels(
  command: string,
  args: string[],
  signal?: AbortSignal,
  timeout = modelDiscoveryTimeout,
): Promise<RuntimeModel[]> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: tmpdir(),
      env: cliEnvironment(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buffer: Buffer = Buffer.alloc(0),
      bytes = 0,
      expectedId = 1,
      stopped = false;
    let stage: 'connect' | 'ping' | 'models' = 'connect';
    let completed: RuntimeModel[] | undefined;
    let failure: Error | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const send = (message: Record<string, unknown>) => {
      if (stopped || child.stdin.destroyed) return;
      const body = JSON.stringify({ jsonrpc: '2.0', ...message });
      child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    };
    const stop = (error?: Error, result?: RuntimeModel[]) => {
      if (stopped) return;
      stopped = true;
      failure = error;
      completed = result;
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
    const receive = (event: {
      jsonrpc?: unknown;
      id?: unknown;
      method?: unknown;
      error?: { code?: unknown };
      result?: unknown;
    }) => {
      if (stopped) return;
      if (!event || event.jsonrpc !== '2.0') throw new Error('Invalid Copilot model response.');
      if (typeof event.method === 'string') {
        if (event.id !== undefined)
          send({
            id: event.id,
            error: { code: -32601, message: 'Unsupported client capability.' },
          });
        return;
      }
      if (event.id !== expectedId) return;
      if (event.error) {
        if (stage === 'connect' && event.error.code === -32601) {
          stage = 'ping';
          send({ id: ++expectedId, method: 'ping', params: {} });
          return;
        }
        throw new Error('Copilot model request failed.');
      }
      if (stage !== 'models') {
        const result = event.result as { protocolVersion?: unknown } | undefined;
        if (!result || typeof result.protocolVersion !== 'number' || result.protocolVersion < 3)
          throw new Error('Unsupported Copilot model protocol.');
        stage = 'models';
        send({ id: ++expectedId, method: 'models.list', params: {} });
      } else stop(undefined, parseCopilotModels(event.result));
    };
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > modelDiscoveryMaxBytes) {
        stop(new Error('Model discovery output exceeded its limit.'));
        return;
      }
      buffer = Buffer.concat([buffer, chunk]);
      try {
        while (!stopped) {
          const end = buffer.indexOf('\r\n\r\n');
          if (end < 0) break;
          const match = buffer
            .subarray(0, end)
            .toString('ascii')
            .match(/(?:^|\r\n)Content-Length:\s*(\d+)\s*(?:\r\n|$)/i);
          const length = match ? Number(match[1]) : 0;
          if (!length || length > modelDiscoveryMaxBytes)
            throw new Error('Invalid Copilot response framing.');
          if (buffer.length < end + 4 + length) break;
          const body = buffer.subarray(end + 4, end + 4 + length).toString('utf8');
          buffer = buffer.subarray(end + 4 + length);
          receive(JSON.parse(body));
        }
      } catch {
        stop(new Error('Could not read the Copilot model catalog.'));
      }
    });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('error', () => {
      stopped = true;
      cleanup();
      reject(new Error('Could not start Copilot model discovery.'));
    });
    child.on('close', () => {
      cleanup();
      if (failure) reject(failure);
      else if (completed !== undefined) resolve(completed);
      else reject(new Error('Copilot exited before returning its models.'));
    });
    send({ id: 1, method: 'connect', params: {} });
  });
}
