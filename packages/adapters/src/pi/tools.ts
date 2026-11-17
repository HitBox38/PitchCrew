import { preGatewayFailure, type ActivityToolKind, type ToolFailureReason } from '@pitchcrew/core';
import {
  asRecord,
  asString,
  commandLine,
  contentText,
  displayPath,
  exitReason,
  type NativeToolFinish,
  type NativeToolParser,
  type NativeToolStart,
} from '../activity/native-tools.ts';

type Call = Omit<NativeToolStart, 'phase' | 'callId'>;
type Outcome = Omit<NativeToolFinish, 'phase' | 'callId'>;

/** Pi's built-in tools, which its oh-my-pi fork names the same way. */
const kinds = new Map<string, ActivityToolKind>(
  Object.entries({
    bash: 'command',
    read: 'read',
    edit: 'edit',
    write: 'edit',
    grep: 'search',
    find: 'search',
    ls: 'search',
  } as const),
);

/** Calls the agent loop refused or gave up on itself: Pitchcrew's daemon never saw them. */
const clientFailures: [RegExp, ToolFailureReason][] = [
  [/^(?:Validation failed|Invalid arguments) for tool\b/, 'invalid_input'],
  [/^Tool execution was blocked\b/, 'not_allowed'],
  [/^Tool call "[^"]*" was not executed\b/, 'limit_reached'],
];
/** The run stopped before or while the call ran. */
const stopped =
  /^(?:Operation aborted|Tool execution was aborted|Tool was not executed because the run was aborted)\b/;

const detailFor = (kind: ActivityToolKind, args: Record<string, unknown>, cwd: string) => {
  if (kind === 'command') {
    const command = asString(args.command);
    return command && commandLine(command);
  }
  const path = asString(args.path);
  const where = path && displayPath(path, cwd);
  if (kind !== 'search') return where;
  const pattern = asString(args.pattern);
  return pattern && where ? `${pattern} in ${where}` : (pattern ?? where);
};

/** A call's kind and target. A Pitchcrew call carries only its tool name, never its arguments. */
const describe = (
  name: string,
  pitchcrew: string | undefined,
  args: Record<string, unknown>,
  cwd: string,
): Call => {
  if (pitchcrew) return { kind: 'mcp', pitchcrew };
  // Another MCP server's tool: its name only.
  if (name.startsWith('mcp__')) return { kind: 'mcp', detail: name.slice(5) };
  const kind = kinds.get(name) ?? 'other';
  return { kind, detail: kind === 'other' ? name : detailFor(kind, args, cwd) };
};

/**
 * oh-my-pi reports its MCP client's own failures (a timeout, a lost connection) as `key: value`
 * lines. The runtime gave up on the call, whatever the daemon later made of it.
 */
const mcpClientFailure = (text: string): Outcome => ({
  failed: true,
  reason: /^message: (.+)$/m.exec(text)?.[1],
  failure: /^failure: timeout$/m.test(text) ? 'timeout' : 'unavailable',
  preGateway: true,
});

/** How a call ended. Its reason is read from text, never from images such as screenshots. */
const outcomeOf = (event: Record<string, unknown>): Outcome => {
  const result = asRecord(event.result);
  const details = asRecord(result?.details);
  if (event.isError !== true && result?.isError !== true && details?.isError !== true)
    return { failed: false };
  // Pi's argument check appends the arguments the model sent, which may hold the user's data.
  const text = (contentText(result?.content).trim() || asString(details?.error) || '')
    .split(/\n\s*Received arguments:/)[0]
    .trim();
  if (stopped.test(text)) return { failed: false, interrupted: true };
  if (/^MCP failure\b/.test(text)) return mcpClientFailure(text);
  const exit = /\n*Command exited with code (-?\d+)$/.exec(text);
  if (exit)
    return {
      failed: true,
      reason: exitReason(Number(exit[1]), text.slice(0, exit.index)),
      failure: 'tool_error',
    };
  const client = clientFailures.find(([pattern]) => pattern.test(text))?.[1];
  // oh-my-pi prefixes an MCP error result with "Error: ".
  const reason = text.replace(/^Error:\s*/, '').replace(/^MCP error(?: -?\d+)?:\s*/, '');
  return {
    failed: true,
    ...(reason ? { reason } : {}),
    ...(client ? { failure: client } : {}),
    ...(client || preGatewayFailure(text) ? { preGateway: true } : {}),
  };
};

/**
 * Pi's agent-loop events, shared by its oh-my-pi fork: `tool_execution_start` and
 * `tool_execution_end` with one call id. The forks differ only in how they name MCP tools.
 */
export const piAgentTools =
  (pitchcrewTool: (name: string) => string | undefined): NativeToolParser =>
  ({ cwd }) =>
  (event) => {
    const callId = asString(event.toolCallId);
    const name = asString(event.toolName);
    if (!callId || !name) return [];
    const pitchcrew = pitchcrewTool(name);
    if (event.type === 'tool_execution_start')
      return [
        { phase: 'start', callId, ...describe(name, pitchcrew, asRecord(event.args) ?? {}, cwd) },
      ];
    if (event.type !== 'tool_execution_end') return [];
    // The finish names the call as well, so a call refused without a start still gets its step.
    return [
      { phase: 'finish', callId, ...describe(name, pitchcrew, {}, cwd), ...outcomeOf(event) },
    ];
  };

/** Pi names MCP tools `mcp__<server>__<tool>`. */
export const piTools = piAgentTools((name) => /^mcp__pitchcrew__(.+)$/.exec(name)?.[1]);
