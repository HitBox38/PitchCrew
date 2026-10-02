import { spawn } from 'node:child_process';
import type { RunContext, RunResult, ChatContext } from '@pitchcrew/core';
import { parseWorkflowResult, terminateCli, runtimeEnvironment } from './process.ts';
import { replyPreview } from './streaming.ts';

// A single ACP session and prompt; the native runtime owns the agent loop.
export async function runAcp(
  command: string,
  args: string[],
  context: RunContext,
  prompt: string,
  env: Record<string, string> = {},
): Promise<RunResult> {
  return parseWorkflowResult(await runAcpText(command, args, context, prompt, env), context);
}
export async function runAcpText(
  command: string,
  args: string[],
  context: RunContext | ChatContext,
  prompt: string,
  env: Record<string, string> = {},
): Promise<string> {
  if (context.signal.aborted) throw new Error('Run cancelled.');
  const preview = replyPreview(context);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: context.directory,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: runtimeEnvironment(context, env),
    });
    let buffer = '',
      stderr = '',
      assistant = '',
      sessionId = '';
    let bytes = 0,
      settled = false,
      expectedId = 1;
    let completed: string | undefined;
    let failure: Error | undefined;
    const send = (message: Record<string, unknown>) => {
      if (!settled && !child.stdin.destroyed)
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
    };
    const stop = (error?: Error, result?: string) => {
      if (settled || failure || completed) return;
      failure = error;
      completed = result;
      terminateCli(child);
    };
    const abort = () => {
      if (sessionId) send({ method: 'session/cancel', params: { sessionId } });
      stop(new Error('Run cancelled.'));
    };
    const timer = setTimeout(
      () => stop(new Error('Runtime exceeded the three-minute limit.')),
      180000,
    );
    context.signal.addEventListener('abort', abort, { once: true });
    const receive = (event: Record<string, unknown>) => {
      if (failure || completed || event.jsonrpc !== '2.0') return;
      if (typeof event.method === 'string') {
        if (event.id !== undefined) {
          // Never grant additional capabilities, including permission to execute native tools.
          if (event.method === 'session/request_permission') {
            send({ id: event.id, result: { outcome: { outcome: 'cancelled' } } });
          } else {
            send({
              id: event.id,
              error: {
                code: -32601,
                message: 'Pitchcrew does not provide this client capability.',
              },
            });
          }
          return;
        }
        if (event.method !== 'session/update' && event.method !== 'session/notification') return;
        const params = event.params as
          | {
              sessionId?: string;
              update?: { sessionUpdate?: string; content?: { type?: string; text?: string } };
            }
          | undefined;
        if (!sessionId || params?.sessionId !== sessionId) return;
        const update = params.update;
        if (update?.sessionUpdate === 'tool_call') {
          assistant = '';
          preview('');
        }
        if (
          update?.sessionUpdate === 'agent_message_chunk' &&
          update.content?.type === 'text' &&
          typeof update.content.text === 'string'
        ) {
          assistant += update.content.text;
          preview(assistant);
        }
        return;
      }
      if (event.id !== expectedId) return;
      if (event.error) {
        const error = event.error as { message?: string };
        stop(
          new Error(
            typeof error.message === 'string' ? error.message : 'ACP runtime request failed.',
          ),
        );
        return;
      }
      const result = event.result as Record<string, unknown> | undefined;
      if (event.id === 1) {
        if (result?.protocolVersion !== 1) {
          stop(new Error('The runtime does not support ACP protocol version 1.'));
          return;
        }
        expectedId = 2;
        send({ id: 2, method: 'session/new', params: { cwd: context.directory, mcpServers: [] } });
      } else if (event.id === 2) {
        if (typeof result?.sessionId !== 'string' || !result.sessionId) {
          stop(new Error('The runtime did not create an ACP session.'));
          return;
        }
        sessionId = result.sessionId;
        expectedId = 3;
        send({
          id: 3,
          method: 'session/prompt',
          params: { sessionId, prompt: [{ type: 'text', text: prompt }] },
        });
      } else {
        if (result?.stopReason !== 'end_turn') {
          stop(
            new Error(
              `The runtime did not complete its turn (${String(result?.stopReason ?? 'missing stop reason')}).`,
            ),
          );
          return;
        }
        if (!assistant) stop(new Error('The runtime returned no assistant answer.'));
        else stop(undefined, assistant);
      }
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 4_000_000) {
        stop(new Error('Runtime output exceeded its limit.'));
        return;
      }
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        try {
          receive(JSON.parse(line) as Record<string, unknown>);
        } catch {
          /* Ignore non-JSON startup lines. */
        }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-3000);
    });
    child.stdin.on('error', () => {
      /* Startup and premature exits are handled below. */
    });
    child.on('error', (error) => {
      settled = true;
      clearTimeout(timer);
      context.signal.removeEventListener('abort', abort);
      reject(error);
    });
    child.on('close', () => {
      if (settled) return;
      if (!failure && !completed && buffer.trim()) {
        try {
          receive(JSON.parse(buffer) as Record<string, unknown>);
        } catch {
          /* No final complete JSON event. */
        }
      }
      settled = true;
      clearTimeout(timer);
      context.signal.removeEventListener('abort', abort);
      if (context.signal.aborted) reject(new Error('Run cancelled.'));
      else if (failure) reject(failure);
      else if (completed) resolve(completed);
      else reject(new Error(stderr.trim() || 'The runtime exited before completing its ACP turn.'));
    });
    send({
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        clientInfo: { name: 'pitchcrew', version: '0.1.0' },
      },
    });
    context.onMessage('CLI started with scoped MCP tools; waiting for its result.');
  });
}
