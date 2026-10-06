import type { RuntimeModel } from '@pitchcrew/core';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import {
  modelDiscoveryMaxBytes,
  modelDiscoveryTimeout,
  normalizeModels,
} from '../model-discovery.ts';
import { cliEnvironment, terminateCli } from '../process.ts';

// SDK initialization reports the native model catalog without a user message or inference.
// https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/query.py
export const claudeModelArgs = [
  '-p',
  '--input-format',
  'stream-json',
  '--output-format',
  'stream-json',
  '--verbose',
  '--safe-mode',
  '--restricted',
  '--tools',
  '',
  '--strict-mcp-config',
  '--mcp-config',
  '{"mcpServers":{}}',
  '--no-session-persistence',
  '--setting-sources',
  '',
  '--settings',
  '{"disableAllHooks":true}',
];

export function parseClaudeModels(result: unknown): RuntimeModel[] {
  const output = result as { models?: unknown } | undefined;
  if (!output || !Array.isArray(output.models)) throw new Error('Invalid Claude model catalog.');
  return normalizeModels(
    output.models.map((row: { value?: unknown; displayName?: unknown }) => {
      if (!row || typeof row.value !== 'string' || typeof row.displayName !== 'string')
        throw new Error('Invalid Claude model row.');
      return { value: row.value, label: row.displayName };
    }),
  );
}

export async function readClaudeModels(
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
    const requestId = 'pitchcrew-models';
    let buffer = '',
      bytes = 0,
      stopped = false;
    let completed: RuntimeModel[] | undefined;
    let failure: Error | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
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
    const receive = (
      event: {
        type?: unknown;
        request_id?: unknown;
        response?: { subtype?: unknown; request_id?: unknown; response?: unknown };
      } | null,
    ) => {
      if (stopped || !event) return;
      if (event.type === 'control_request') {
        if (typeof event.request_id !== 'string')
          throw new Error('Invalid Claude control request.');
        send({
          type: 'control_response',
          response: {
            subtype: 'error',
            request_id: event.request_id,
            error: 'Model discovery does not support this request.',
          },
        });
        return;
      }
      if (event.type !== 'control_response' || event.response?.request_id !== requestId) return;
      if (event.response.subtype !== 'success') throw new Error('Claude model request failed.');
      stop(undefined, parseClaudeModels(event.response.response));
    };
    const countBytes = (chunk: string | Buffer) => {
      if (stopped) return false;
      bytes += Buffer.byteLength(chunk);
      if (bytes <= modelDiscoveryMaxBytes) return true;
      stop(new Error('Model discovery output exceeded its limit.'));
      return false;
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (!countBytes(chunk)) return;
      buffer += chunk;
      let end: number;
      while (!stopped && (end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        let event: Parameters<typeof receive>[0];
        try {
          event = JSON.parse(line) as Parameters<typeof receive>[0];
        } catch {
          continue;
        }
        try {
          receive(event);
        } catch {
          stop(new Error('Could not read the Claude model catalog.'));
        }
      }
    });
    // Bound and discard diagnostics, including any account or provider metadata.
    child.stderr.on('data', (chunk: Buffer) => countBytes(chunk));
    child.stdin.on('error', () => {});
    child.on('error', () => {
      stopped = true;
      cleanup();
      reject(new Error('Could not start Claude model discovery.'));
    });
    child.on('close', () => {
      cleanup();
      if (failure) reject(failure);
      else if (completed !== undefined) resolve(completed);
      else reject(new Error('Claude exited before returning its models.'));
    });
    send({ type: 'control_request', request_id: requestId, request: { subtype: 'initialize' } });
  });
}
