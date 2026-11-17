import type { ActivityToolKind, ToolFailureReason } from '@pitchcrew/core';
import {
  asRecord,
  asString,
  commandLine,
  displayPath,
  displayUrl,
  exitReason,
  type NativeToolFinish,
  type NativeToolParser,
  type NativeToolStart,
} from '../activity/native-tools.ts';

type Call = Omit<NativeToolStart, 'phase' | 'callId'>;
type Outcome = Omit<NativeToolFinish, 'phase' | 'callId'>;

/** Hermes's built-in tools. */
const kinds = new Map<string, ActivityToolKind>(
  Object.entries({
    terminal: 'command',
    process_manage: 'command',
    execute_code: 'command',
    read_file: 'read',
    write_file: 'edit',
    patch: 'edit',
    search_files: 'search',
    session_search: 'search',
    web_search: 'web_search',
    x_search: 'web_search',
    web_extract: 'fetch',
    delegate_task: 'agent',
    todo_list: 'todo',
  } as const),
);
// Hermes names MCP tools `mcp_<server>_<tool>`; its toolsets reference writes `mcp__<server>__`.
const pitchcrewTool = /^mcp_{1,2}pitchcrew_{1,2}(.+)$/;

/** Hermes's own MCP client errors: the daemon never received these calls. */
const clientFailures: [RegExp, ToolFailureReason][] = [
  [/^MCP server '[^']*' is not connected\b/, 'unavailable'],
  [/^MCP call failed: \w*Timeout/, 'timeout'],
  [/^MCP call failed:/, 'unavailable'],
  [/^Unknown tool:/, 'not_found'],
  [/^timed out after\b/, 'timeout'],
];
/** Hermes reports a call it abandoned or skipped, rather than failed. */
const stopped = /^\[Tool execution (?:cancelled|skipped)\b|^MCP call interrupted\b/;

const detailFor = (kind: ActivityToolKind, input: Record<string, unknown>, cwd: string) => {
  const path = asString(input.path);
  const where = path && displayPath(path, cwd);
  switch (kind) {
    case 'command': {
      const command = asString(input.command);
      return command && commandLine(command);
    }
    case 'read':
    case 'edit':
      return where;
    case 'search': {
      const pattern = asString(input.pattern) ?? asString(input.query);
      return pattern && where ? `${pattern} in ${where}` : (pattern ?? where);
    }
    case 'web_search':
      return asString(input.query);
    case 'fetch': {
      const url = Array.isArray(input.urls) ? asString(input.urls[0]) : asString(input.url);
      return url && displayUrl(url);
    }
  }
  // A subagent's goal is the whole instruction the model wrote for it, so it shows no detail.
  return undefined;
};

/** A call's kind and target. A Pitchcrew call carries only its tool name, never its arguments. */
const describe = (name: string, input: Record<string, unknown>, cwd: string): Call => {
  const pitchcrew = pitchcrewTool.exec(name)?.[1];
  if (pitchcrew) return { kind: 'mcp', pitchcrew };
  // Another MCP server's tool: its name only.
  if (name.startsWith('mcp_')) return { kind: 'mcp', detail: name.replace(/^mcp_{1,2}/, '') };
  const kind = kinds.get(name) ?? 'other';
  return { kind, detail: kind === 'other' ? name : detailFor(kind, input, cwd) };
};

/** Hermes reports tool errors as JSON such as `{"error": …}`, and exceptions as plain text. */
const parseResult = (output: string) => {
  try {
    return asRecord(JSON.parse(output));
  } catch {
    return undefined;
  }
};

/** Why a call failed, in Hermes's words. */
const failureOf = (
  output: string,
  result: Record<string, unknown> | undefined,
): Pick<Outcome, 'reason' | 'failure'> => {
  if (result) {
    const message = asString(result.error) ?? asString(result.message);
    const code = result.exit_code;
    return typeof code === 'number' && code !== 0
      ? { reason: exitReason(code, message ?? asString(result.output)), failure: 'tool_error' }
      : { reason: message };
  }
  if (!output.startsWith('{'))
    return { reason: output.replace(/^Error executing tool '[^']*':\s*/, '') };
  // Hermes cuts results at 5000 characters; a cut JSON object may still show its exit code.
  const code = Number(/"exit_code":\s*(-?\d+)/.exec(output)?.[1] ?? 0);
  return code ? { reason: exitReason(code), failure: 'tool_error' } : {};
};

/** How a call ended. Hermes marks a failure with `is_error`, and explains it in `output`. */
const outcomeOf = (event: Record<string, unknown>): Outcome => {
  const output = typeof event.output === 'string' ? event.output.trim() : '';
  const result = parseResult(output);
  // A call Hermes abandoned or skipped stopped rather than failed, whatever `is_error` says.
  if (result?.status === 'cancelled' || stopped.test(asString(result?.error) ?? output))
    return { failed: false, interrupted: true };
  if (event.is_error !== true) return { failed: false };
  const { reason, failure } = failureOf(output, result);
  const client = clientFailures.find(([pattern]) => pattern.test(reason ?? ''))?.[1];
  const closed = client ?? failure;
  return {
    failed: true,
    ...(reason ? { reason } : {}),
    ...(closed ? { failure: closed } : {}),
    ...(client ? { preGateway: true } : {}),
  };
};

/**
 * Hermes's stream-json `tool_use` and `tool_result` events. Its executor sends no call ids today,
 * so a result belongs to the oldest unfinished call of the same tool: Hermes reports a batch's
 * results in the order it started them. A refused call reports neither event.
 */
export const hermesTools: NativeToolParser = ({ cwd }) => {
  const open: { name: string; callId: string }[] = [];
  let count = 0;
  return (event) => {
    const name = asString(event.name);
    if (!name || (event.type !== 'tool_use' && event.type !== 'tool_result')) return [];
    const id = asString(event.tool_call_id);
    if (event.type === 'tool_use') {
      const callId = id ?? `${name}#${++count}`;
      open.push({ name, callId });
      // Bounded: a long turn keeps only recent unfinished calls.
      if (open.length > 256) open.shift();
      return [{ phase: 'start', callId, ...describe(name, asRecord(event.input) ?? {}, cwd) }];
    }
    const index = open.findIndex((call) => (id ? call.callId === id : call.name === name));
    // A result without its start names the call itself.
    if (index < 0)
      return [
        {
          phase: 'finish',
          callId: id ?? `${name}#${++count}`,
          ...describe(name, {}, cwd),
          ...outcomeOf(event),
        },
      ];
    const [{ callId }] = open.splice(index, 1);
    return [{ phase: 'finish', callId, ...outcomeOf(event) }];
  };
};
