import { preGatewayFailure, type ActivityToolKind } from '@pitchcrew/core';
import {
  asRecord,
  asString,
  contentText,
  exitReason,
  inputDetail,
  type NativeToolEvent,
  type NativeToolFinish,
  type NativeToolParser,
  type NativeToolStart,
} from '../activity/native-tools.ts';

/** Claude Code's built-in tools; MCP tools are named `mcp__<server>__<tool>`. */
const kinds = new Map<string, ActivityToolKind>(
  Object.entries({
    Bash: 'command',
    PowerShell: 'command',
    Monitor: 'command',
    Read: 'read',
    Write: 'edit',
    Edit: 'edit',
    MultiEdit: 'edit',
    NotebookEdit: 'edit',
    Glob: 'search',
    Grep: 'search',
    LS: 'search',
    ToolSearch: 'search',
    WebFetch: 'fetch',
    WebSearch: 'web_search',
    Agent: 'agent',
    Task: 'agent',
    TodoWrite: 'todo',
  } as const),
);
const pitchcrewTool = /^mcp__pitchcrew__(.+)$/;
const mcpTool = /^mcp__(.+?)__(.+)$/;

/** A call's kind and target. A Pitchcrew call carries only its tool name, never its arguments. */
const describe = (
  name: string,
  input: Record<string, unknown>,
  cwd: string,
): Omit<NativeToolStart, 'phase' | 'callId'> => {
  const pitchcrew = pitchcrewTool.exec(name)?.[1];
  if (pitchcrew) return { kind: 'mcp', pitchcrew };
  const mcp = mcpTool.exec(name);
  if (mcp) return { kind: 'mcp', detail: `${mcp[2]} (${mcp[1]})` };
  const kind = kinds.get(name) ?? 'other';
  return { kind, detail: kind === 'other' ? name : inputDetail(kind, input, cwd) };
};

/**
 * Claude Code's answer to input it could not parse as JSON quotes up to 200 bytes of the call's
 * raw arguments after this marker, on the line after the sentence naming the tool.
 */
const echoedInput = /You sent \(first \d+ of \d+ bytes\):/;

/** A failed tool_result's reason. Its text never includes images, such as screenshots. */
const failureOf = (
  content: unknown,
  pitchcrew: string | undefined,
): Omit<NativeToolFinish, 'phase' | 'callId' | 'failed'> => {
  // Nothing from the echo marker on is kept, so the raw arguments never become step text.
  const [before = '', echoed] = contentText(content)
    .replace(/<\/?tool_use_error>/g, '')
    .split(echoedInput);
  const text = before.trim();
  const exit = /^Exit code (-?\d+)\b([\s\S]*)$/.exec(text);
  if (exit) return { reason: exitReason(Number(exit[1]), exit[2]), failure: 'tool_error' };
  return {
    reason: text,
    // Stated, so words in the quoted arguments never choose the reason diagnostics carry.
    ...(echoed !== undefined ? { failure: 'invalid_input' as const } : {}),
    // Claude Code's own refusals (permission, unknown tool, input checks) name the call by its
    // qualified name; Pitchcrew's daemon answers in its own words, and records that answer itself.
    ...(pitchcrew
      ? { preGateway: preGatewayFailure(text) || text.includes('mcp__pitchcrew__') }
      : {}),
  };
};

const blocks = (message: unknown, type: string) => {
  const content = asRecord(message)?.content;
  return Array.isArray(content)
    ? content.flatMap((value) => {
        const block = asRecord(value);
        return block?.type === type ? [block] : [];
      })
    : [];
};

/**
 * Claude Code's stream-json events. Calls start from the complete assistant message: it is sent
 * in chat and in deep review alike, ahead of the call's result, and carries the input the detail
 * needs. The chat-only partial `content_block_start` has just the name, and a call's detail is
 * fixed at its start.
 */
export const claudeCodeTools: NativeToolParser = ({ cwd }) => {
  // Every call this turn, by id: a tool_result names only the id, and a tool_use sent again must
  // not restart a finished call.
  const calls = new Map<string, { pitchcrew?: string; open: boolean }>();
  const start = (block: Record<string, unknown>): NativeToolEvent[] => {
    const callId = asString(block.id);
    const name = asString(block.name);
    if (!callId || !name || calls.has(callId)) return [];
    const call = describe(name, asRecord(block.input) ?? {}, cwd);
    calls.set(callId, { pitchcrew: call.pitchcrew, open: true });
    if (calls.size > 256) calls.delete(calls.keys().next().value!);
    return [{ phase: 'start', callId, ...call }];
  };
  /** Ends a call this parser started and has not ended yet. */
  const end = (
    callId: string | undefined,
    finish: (callId: string, pitchcrew?: string) => NativeToolEvent,
  ): NativeToolEvent[] => {
    const call = callId ? calls.get(callId) : undefined;
    if (!callId || !call?.open) return [];
    call.open = false;
    return [finish(callId, call.pitchcrew)];
  };
  const finish = (block: Record<string, unknown>) =>
    end(asString(block.tool_use_id), (callId, pitchcrew) =>
      block.is_error === true
        ? { phase: 'finish', callId, failed: true, ...failureOf(block.content, pitchcrew) }
        : { phase: 'finish', callId, failed: false },
    );
  // Calls the permission settings refused never reached any server. Their recorded input is
  // never read: for Pitchcrew calls it holds private arguments.
  const deny = (denial: unknown) =>
    end(asString(asRecord(denial)?.tool_use_id), (callId) => ({
      phase: 'finish',
      callId,
      failed: true,
      failure: 'not_allowed',
      preGateway: true,
    }));
  return (event) => {
    // A subagent's calls belong to its own turn.
    if (event.parent_tool_use_id) return [];
    if (event.type === 'assistant') return blocks(event.message, 'tool_use').flatMap(start);
    if (event.type === 'user') return blocks(event.message, 'tool_result').flatMap(finish);
    if (event.type === 'result' && Array.isArray(event.permission_denials))
      return event.permission_denials.flatMap(deny);
    return [];
  };
};
