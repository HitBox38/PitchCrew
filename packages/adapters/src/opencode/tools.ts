import type { ActivityToolKind } from '@pitchcrew/core';
import {
  asRecord,
  asString,
  exitReason,
  inputDetail,
  type NativeToolEvent,
  type NativeToolFinish,
  type NativeToolParser,
} from '../activity/native-tools.ts';

/** OpenCode's built-in tools. MCP tools are named `<server>_<tool>`. */
const kinds = new Map<string, ActivityToolKind>(
  Object.entries({
    bash: 'command',
    read: 'read',
    write: 'edit',
    edit: 'edit',
    multiedit: 'edit',
    patch: 'edit',
    apply_patch: 'edit',
    glob: 'search',
    grep: 'search',
    list: 'search',
    codesearch: 'search',
    webfetch: 'fetch',
    websearch: 'web_search',
    task: 'agent',
    todowrite: 'todo',
    todoread: 'todo',
  } as const),
);
const pitchcrewTool = /^pitchcrew_(.+)$/;

/** A call's kind and target. A Pitchcrew call carries only its tool name, never its arguments. */
const describe = (
  tool: string,
  input: Record<string, unknown>,
  cwd: string,
): Pick<NativeToolFinish, 'kind' | 'detail' | 'pitchcrew'> => {
  const pitchcrew = pitchcrewTool.exec(tool)?.[1];
  if (pitchcrew) return { kind: 'mcp', pitchcrew };
  const kind = kinds.get(tool) ?? 'other';
  return { kind, detail: kind === 'other' ? tool : inputDetail(kind, input, cwd) };
};

/**
 * OpenCode reroutes a call it could not match to a tool, or whose arguments failed its checks,
 * to its `invalid` tool. That error text quotes the arguments, so only the kind of failure is kept.
 */
const invalidCall = (
  input: Record<string, unknown>,
): Omit<NativeToolFinish, 'phase' | 'callId'> => {
  const attempted = asString(input.tool) ?? '';
  const unknown = /unavailable tool|no such tool|not found/i.test(asString(input.error) ?? '');
  const failure = unknown
    ? { failure: 'not_found' as const, reason: 'No tool by that name is available.' }
    : { failure: 'invalid_input' as const };
  const pitchcrew = pitchcrewTool.exec(attempted)?.[1];
  return pitchcrew
    ? { pitchcrew, failed: true, preGateway: true, ...failure }
    : { kind: 'other', detail: attempted, failed: true, ...failure };
};

const outcome = (
  tool: string,
  state: Record<string, unknown>,
): Pick<NativeToolFinish, 'failed' | 'reason' | 'failure'> => {
  if (state.status === 'error')
    return {
      failed: true,
      reason: asString(state.error) ?? asString(asRecord(state.error)?.message),
    };
  // A command that exits non-zero still completes; its exit code says it failed.
  const exit = asRecord(state.metadata)?.exit;
  if (tool === 'bash' && typeof exit === 'number' && exit !== 0)
    return {
      failed: true,
      reason: exitReason(exit, asString(state.output)),
      failure: 'tool_error',
    };
  return { failed: false };
};

/**
 * OpenCode's `run --format json` reports a call once it has finished, in one `tool_use` event, so
 * each finish describes its call. Calls of subagent sessions are left out by OpenCode itself.
 */
export const opencodeTools: NativeToolParser =
  ({ cwd }) =>
  (event): NativeToolEvent[] => {
    const part = event.type === 'tool_use' ? asRecord(event.part) : undefined;
    const state = asRecord(part?.state);
    const tool = asString(part?.tool);
    // Version 1.18 names the call `callID` beside the part's own `id`; its successor names the
    // call `id` beside a `partID`.
    const callId = asString(part?.callID) ?? asString(part?.id);
    if (part?.type !== 'tool' || !state || !tool || !callId) return [];
    if (state.status !== 'completed' && state.status !== 'error') return [];
    const input = asRecord(state.input) ?? {};
    if (tool === 'invalid') return [{ phase: 'finish', callId, ...invalidCall(input) }];
    return [{ phase: 'finish', callId, ...describe(tool, input, cwd), ...outcome(tool, state) }];
  };
