import type { ActivityToolKind } from '@pitchcrew/core';
import {
  asRecord,
  asString,
  commandLine,
  contentText,
  displayPath,
  displayUrl,
  exitReason,
  type NativeToolFinish,
  type NativeToolParser,
  type NativeToolStart,
} from '../activity/native-tools.ts';

type Args = Record<string, unknown>;
type Call = Pick<NativeToolStart, 'kind' | 'detail' | 'pitchcrew'>;
type Outcome = Omit<NativeToolFinish, 'phase' | 'callId'>;
type Describe = (args: Args, cwd: string) => string | undefined;

const command: Describe = (args) => {
  const value = asString(args.command);
  return value && commandLine(value);
};
const filePath: Describe = (args, cwd) => {
  const value = asString(args.path);
  return value && displayPath(value, cwd);
};
const search: Describe = (args, cwd) => {
  const pattern = asString(args.pattern);
  const directory = asString(args.path);
  return pattern && (directory ? `${pattern} in ${displayPath(directory, cwd)}` : pattern);
};
const webAddress: Describe = (args) => {
  const url = asString(args.url);
  return url && displayUrl(url);
};

/** Copilot's built-in tools. Pitchcrew's launch denies them, but a call to one still shows. */
const builtIns: Record<string, [ActivityToolKind, Describe?]> = {
  bash: ['command', command],
  powershell: ['command', command],
  view: ['read', filePath],
  create: ['edit', filePath],
  edit: ['edit', filePath],
  apply_patch: ['edit'],
  grep: ['search', search],
  rg: ['search', search],
  glob: ['search', search],
  web_fetch: ['fetch', webAddress],
  web_search: ['web_search', (args) => asString(args.query)],
  task: ['agent', (args) => asString(args.description)],
  ask_user: ['ask'],
};

/**
 * A tool start (`toolName`) or an assistant's tool request (`name`). MCP tools are named
 * `<server>-<tool>` and carry their server's configured key, which older events may replace with a
 * display name; the adapter registers Pitchcrew's server as `pitchcrew`.
 */
const describe = (item: Args, cwd: string): Call | undefined => {
  const name = asString(item.toolName) ?? asString(item.name);
  const server = asString(item.mcpConfigServerName) ?? asString(item.mcpServerName);
  const tool = asString(item.mcpToolName);
  if (!name) return undefined;
  if (server === 'pitchcrew' || name.startsWith('pitchcrew-'))
    return { kind: 'mcp', pitchcrew: tool ?? name.replace(/^pitchcrew-/, '') };
  // Another server's tool shows its names only, never its arguments.
  if (server) return { kind: 'mcp', detail: `${tool ?? name} (${server})` };
  if (!Object.hasOwn(builtIns, name)) return { kind: 'other' };
  const [kind, detail] = builtIns[name];
  return { kind, detail: detail?.(asRecord(item.arguments) ?? {}, cwd) };
};

/**
 * Copilot ends a command's output with a status line such as
 * `<shellId: 0 completed with exit code 1>`; the line before it says why.
 */
const shellStatus = /^<shellId: [^>]*>$/gm;

const outcome = (data: Args): Outcome => {
  const exitCode = asRecord(data.shellExecution)?.exitCode;
  const message =
    asString(asRecord(data.error)?.message) ??
    asString(contentText(asRecord(data.result)?.content));
  // A command's exit code fails the call even when Copilot reports the tool itself succeeded.
  if (typeof exitCode === 'number' && exitCode !== 0)
    return {
      failed: true,
      reason: exitReason(exitCode, message?.replace(shellStatus, '')),
      failure: 'tool_error',
    };
  return data.success === false ? { failed: true, reason: message } : { failed: false };
};

/**
 * Copilot's JSON output: `tool.execution_start` and `tool.execution_complete` linked by
 * `toolCallId`. Sub-agent events (the envelope's `agentId`, or the deprecated `parentToolCallId`)
 * belong to the sub-agent, not this turn.
 */
export const copilotCliTools: NativeToolParser = ({ cwd }) => {
  // A call refused before it starts (a denied permission) completes without a start event, so
  // each requested call stays described until it starts or completes.
  const requested = new Map<string, Call>();
  const request = (value: unknown) => {
    const item = asRecord(value);
    const callId = asString(item?.toolCallId);
    const call = item && describe(item, cwd);
    if (!callId || !call) return;
    requested.set(callId, call);
    if (requested.size > 256) requested.delete(requested.keys().next().value!);
  };
  return (event) => {
    const data = asRecord(event.data) ?? {};
    if (event.agentId || data.parentToolCallId) return [];
    if (event.type === 'assistant.message') {
      if (Array.isArray(data.toolRequests)) data.toolRequests.forEach(request);
      return [];
    }
    const callId = asString(data.toolCallId);
    if (!callId) return [];
    if (event.type === 'tool.execution_start') {
      requested.delete(callId);
      const call = describe(data, cwd);
      return call ? [{ phase: 'start', callId, ...call }] : [];
    }
    if (event.type !== 'tool.execution_complete' || typeof data.success !== 'boolean') return [];
    const unstarted = requested.get(callId);
    requested.delete(callId);
    // A call that never started never reached Pitchcrew's daemon either.
    return [
      {
        phase: 'finish',
        callId,
        ...outcome(data),
        ...(unstarted && { ...unstarted, preGateway: true }),
      },
    ];
  };
};
