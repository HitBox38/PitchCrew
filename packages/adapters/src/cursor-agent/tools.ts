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
const search = (pattern: unknown, directory: unknown, cwd: string) => {
  const text = asString(pattern);
  const folder = asString(directory);
  return text && (folder ? `${text} in ${displayPath(folder, cwd)}` : text);
};
const webAddress: Describe = (args) => {
  const url = asString(args.url);
  return url && displayUrl(url);
};

/**
 * Cursor's own tools by their `<kind>ToolCall` key. Pitchcrew's launch denies them, but a call to
 * one still shows.
 */
const builtIns: Record<string, [ActivityToolKind, Describe?]> = {
  shellToolCall: ['command', command],
  readToolCall: ['read', filePath],
  lsToolCall: ['read', filePath],
  editToolCall: ['edit', filePath],
  writeToolCall: ['edit', filePath],
  deleteToolCall: ['edit', filePath],
  grepToolCall: ['search', (args, cwd) => search(args.pattern, args.path, cwd)],
  globToolCall: [
    'search',
    (args, cwd) => search(args.globPattern ?? args.pattern, args.targetDirectory, cwd),
  ],
  semSearchToolCall: ['search', (args) => asString(args.query)],
  webSearchToolCall: ['web_search', (args) => asString(args.searchTerm) ?? asString(args.query)],
  webFetchToolCall: ['fetch', webAddress],
  updateTodosToolCall: ['todo'],
  taskToolCall: ['agent', (args) => asString(args.description)],
  listMcpResourcesToolCall: ['mcp'],
  readMcpResourceToolCall: ['mcp'],
};

/**
 * An MCP call names its server by its `.cursor/mcp.json` key (`providerIdentifier`), which the
 * adapter sets to `pitchcrew`, and the tool as `<server>-<tool>`.
 */
const mcpCall = (args: Args): Call | undefined => {
  const server = asString(args.providerIdentifier);
  const name = asString(args.name);
  if (server === 'pitchcrew' || name?.startsWith('pitchcrew-')) {
    const tool = asString(args.toolName) ?? name?.replace(/^pitchcrew-/, '');
    return tool ? { kind: 'mcp', pitchcrew: tool } : undefined;
  }
  // Another server's tool shows its names only, never its arguments.
  const tool = asString(args.toolName) ?? name;
  return tool ? { kind: 'mcp', detail: server ? `${tool} (${server})` : tool } : undefined;
};

const describe = (key: string | undefined, call: Args, cwd: string): Call | undefined => {
  // Tools Cursor does not type arrive as `function: {name, arguments}`.
  if (!key) return asString(call.name) ? { kind: 'other' } : undefined;
  const args = asRecord(call.args) ?? {};
  if (key === 'mcpToolCall') return mcpCall(args);
  if (!Object.hasOwn(builtIns, key)) return { kind: 'other' };
  const [kind, detail] = builtIns[key];
  return { kind, detail: detail?.(args, cwd) };
};

/** An MCP result's text: MCP blocks, or the `{text: {text}}` blocks of Cursor's own schema. */
const resultText = (content: unknown) =>
  asString(contentText(content)) ??
  (Array.isArray(content)
    ? content.map((block) => asString(asRecord(asRecord(block)?.text)?.text)).find(Boolean)
    : undefined);

/** The `error` arm is a string or an object, depending on the tool. */
const errorText = (value: unknown) => {
  const error = asRecord(value);
  return (
    asString(value) ??
    asString(error?.errorMessage) ??
    asString(error?.message) ??
    asString(error?.error)
  );
};

/** A completed call's result holds one arm: `success`, or why the call did not succeed. */
const outcome = (result: Args): Outcome => {
  // Refused by the run's tool permissions, so the call never ran. The reason may be empty.
  if (result.rejected !== undefined)
    return {
      failed: true,
      reason: asString(asRecord(result.rejected)?.reason),
      failure: 'not_allowed',
      preGateway: true,
    };
  if (result.permissionDenied !== undefined)
    return { failed: true, failure: 'not_allowed', preGateway: true };
  if (result.timeout !== undefined) return { failed: true, failure: 'timeout' };
  if (result.spawnError !== undefined)
    return { failed: true, reason: errorText(asRecord(result.spawnError)?.error) };
  if (result.error !== undefined) return { failed: true, reason: errorText(result.error) };
  const output = asRecord(result.failure ?? result.success);
  if (output?.aborted === true) return { failed: false, interrupted: true };
  const exitCode = output?.exitCode;
  if (typeof exitCode === 'number' && exitCode !== 0)
    return {
      failed: true,
      reason: exitReason(exitCode, asString(output?.stderr) ?? asString(output?.stdout)),
      failure: 'tool_error',
    };
  if (result.failure !== undefined) return { failed: true, reason: asString(output?.stderr) };
  if (output?.isError === true) return { failed: true, reason: resultText(output.content) };
  return result.success !== undefined
    ? { failed: false }
    : { failed: true, failure: 'unclassified' };
};

/**
 * Cursor's stream-json `tool_call` events, `started` then `completed`, linked by `call_id`. A
 * completion can be lost after a reconnect; its step then stays running until the turn ends.
 */
export const cursorAgentTools: NativeToolParser =
  ({ cwd }) =>
  (event) => {
    if (event.type !== 'tool_call') return [];
    const wrapper = asRecord(event.tool_call) ?? {};
    // The call sits under its one `<kind>ToolCall` key, beside ids, timings and hook context.
    const key = Object.keys(wrapper).find((name) => name.endsWith('ToolCall'));
    const call = asRecord(key ? wrapper[key] : wrapper.function) ?? {};
    const callId = asString(event.call_id) ?? asString(wrapper.toolCallId);
    if (!callId) return [];
    if (event.subtype === 'started') {
      const described = describe(key, call, cwd);
      return described ? [{ phase: 'start', callId, ...described }] : [];
    }
    const result = asRecord(call.result);
    return event.subtype === 'completed' && result
      ? [{ phase: 'finish', callId, ...outcome(result) }]
      : [];
  };
