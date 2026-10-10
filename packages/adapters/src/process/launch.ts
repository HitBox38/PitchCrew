import type { ChatContext, RunContext, RunResult } from '@pitchcrew/core';
import { chatResultSchema } from '@pitchcrew/core';
import { spawn, type ChildProcess } from 'node:child_process';
import { chatEventStream } from '../streaming.ts';
import { runtimeEnvironment, runtimeTimeLimit } from './environment.ts';
import { chatPromptFor } from './prompts.ts';
import { cleanResult, parseWorkflowResult } from './results.ts';

export function terminateCli(child: ChildProcess) {
  if (process.platform === 'win32' && child.pid)
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  else child.kill('SIGTERM');
}
export async function chatCli(
  command: string,
  args: string[],
  context: ChatContext,
  extract: (event: Record<string, unknown>) => string | null,
) {
  const text = await runCliText(command, args, context, chatPromptFor(context), extract);
  return chatResultSchema.parse(JSON.parse(cleanResult(text)));
}
export async function runCli(
  command: string,
  args: string[],
  context: RunContext,
  prompt: string,
  extract: (event: Record<string, unknown>) => string | null,
  env: Record<string, string | undefined> = {},
): Promise<RunResult> {
  return parseWorkflowResult(
    await runCliText(command, args, context, prompt, extract, env),
    context,
  );
}
export async function runCliText(
  command: string,
  args: string[],
  context: RunContext | ChatContext,
  prompt: string,
  extract: (event: Record<string, unknown>) => string | null,
  env: Record<string, string | undefined> = {},
): Promise<string> {
  if (context.signal.aborted) throw new Error('Run cancelled.');
  const stream = chatEventStream(context);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: 'session' in context && context.session ? context.session.directory : context.directory,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: runtimeEnvironment(context, env),
    });
    let buffer = '',
      result = '',
      error = '',
      bytes = 0;
    let timedOut = false;
    const kill = () => terminateCli(child);
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, runtimeTimeLimit);
    context.signal.addEventListener('abort', kill, { once: true });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 4_000_000) {
        error = 'Runtime output exceeded its limit.';
        kill();
        return;
      }
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          stream.event(event);
          const text = extract(event);
          if (text) {
            result = text;
            stream.replace(text);
          }
        } catch {
          /* CLIs may print a non-JSON startup line. */
        }
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      error = (error + chunk.toString()).slice(-3000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      context.signal.removeEventListener('abort', kill);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      context.signal.removeEventListener('abort', kill);
      if (context.signal.aborted) {
        reject(new Error('Run cancelled.'));
        return;
      }
      if (timedOut) {
        reject(
          new Error(
            `Pitchcrew stopped the runtime after its ${runtimeTimeLimit / 60000}-minute limit.`,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(new Error(error.trim() || `Runtime exited with code ${code}.`));
        return;
      }
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer) as Record<string, unknown>;
          stream.event(event);
          const text = extract(event);
          if (text) {
            result = text;
            stream.replace(text);
          }
        } catch {
          /* No final complete JSON event. */
        }
      }
      resolve(result);
    });
    child.stdin.on('error', () => {
      /* Process startup errors are handled above. */
    });
    child.stdin.end(prompt);
    context.onMessage('CLI started with restricted tools; waiting for its result.');
  });
}
