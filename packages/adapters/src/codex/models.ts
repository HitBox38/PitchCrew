import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { RuntimeModel } from '@pitchcrew/core';
import { cliEnvironment, terminateCli } from '../process.ts';
import {
  modelDiscoveryMaxBytes,
  modelDiscoveryTimeout,
  normalizeModels,
} from '../model-discovery.ts';

// https://learn.chatgpt.com/docs/app-server#list-models-modellist
// Initialize a private stdio connection, list models, then exit. No thread or turn is created.
export const codexModelArgs = [
  'app-server',
  '--listen',
  'stdio://',
  '-c',
  'features.apps=false',
  '-c',
  'features.hooks=false',
  '-c',
  'analytics.enabled=false',
];

export async function readCodexModels(
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
    let buffer = '',
      bytes = 0,
      expectedId = 1,
      stopped = false;
    let completed: RuntimeModel[] | undefined;
    let failure: Error | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const models: RuntimeModel[] = [];
    const cursors = new Set<string>();
    const send = (message: Record<string, unknown>) => {
      if (!stopped && !child.stdin.destroyed) child.stdin.write(JSON.stringify(message) + '\n');
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
    const listPage = (cursor?: string) =>
      send({
        id: ++expectedId,
        method: 'model/list',
        params: { limit: 100, includeHidden: false, ...(cursor ? { cursor } : {}) },
      });
    const receive = (event: Record<string, unknown>) => {
      if (stopped) return;
      if (typeof event.method === 'string') {
        if (event.id !== undefined)
          send({
            id: event.id,
            error: { code: -32601, message: 'Unsupported client capability.' },
          });
        return;
      }
      if (event.id !== expectedId) return;
      if (event.error) throw new Error('Codex model request failed.');
      if (expectedId === 1) {
        if (!event.result || typeof event.result !== 'object')
          throw new Error('Invalid Codex initialization.');
        send({ method: 'initialized', params: {} });
        listPage();
        return;
      }
      const result = event.result as { data?: unknown; nextCursor?: unknown } | undefined;
      if (!result || !Array.isArray(result.data)) throw new Error('Invalid Codex model page.');
      for (const row of result.data as {
        model?: unknown;
        displayName?: unknown;
        hidden?: unknown;
      }[]) {
        if (!row) throw new Error('Invalid Codex model row.');
        if (row.hidden === true) continue;
        if (typeof row.model !== 'string' || typeof row.displayName !== 'string')
          throw new Error('Invalid Codex model row.');
        models.push({ value: row.model, label: row.displayName });
      }
      if (models.length > 5000) throw new Error('Codex model catalog exceeded its limit.');
      if (result.nextCursor !== null && result.nextCursor !== undefined) {
        if (
          typeof result.nextCursor !== 'string' ||
          !result.nextCursor ||
          cursors.has(result.nextCursor) ||
          cursors.size >= 50
        )
          throw new Error('Invalid Codex model cursor.');
        cursors.add(result.nextCursor);
        listPage(result.nextCursor);
      } else stop(undefined, normalizeModels(models));
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > modelDiscoveryMaxBytes) {
        stop(new Error('Model discovery output exceeded its limit.'));
        return;
      }
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        try {
          receive(event);
        } catch {
          stop(new Error('Could not read the Codex model catalog.'));
        }
      }
    });
    // Drain diagnostics without retaining credentials or other provider metadata.
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('error', () => {
      stopped = true;
      cleanup();
      reject(new Error('Could not start Codex model discovery.'));
    });
    child.on('close', () => {
      cleanup();
      if (failure) reject(failure);
      else if (completed !== undefined) resolve(completed);
      else reject(new Error('Codex exited before returning its models.'));
    });
    send({
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: 'pitchcrew', version: '0.1.0' } },
    });
  });
}
