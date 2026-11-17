import {
  nativeFailureReason,
  preGatewayFailure,
  type ActivityToolKind,
  type ToolFailureReason,
} from '@pitchcrew/core';
import {
  asRecord,
  asString,
  commandLine,
  contentText,
  displayPath,
  displayUrl,
  planProgress,
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
const filePath =
  (key: string): Describe =>
  (args, cwd) => {
    const value = asString(args[key]);
    return value && displayPath(value, cwd);
  };
const search: Describe = (args, cwd) => {
  const pattern = asString(args.pattern);
  const directory = asString(args.dir_path);
  return pattern && (directory ? `${pattern} in ${displayPath(directory, cwd)}` : pattern);
};
/** web_fetch takes a free-text prompt; only the first web address in it is shown. */
const promptUrl: Describe = (args) => {
  const url = asString(args.prompt)?.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  return url && displayUrl(url.replace(/[).,;:!?]+$/, ''));
};

/** Gemini's own tools. Pitchcrew registers none of them, but a call to one still shows. */
const builtIns: Record<string, [ActivityToolKind, Describe?]> = {
  run_shell_command: ['command', command],
  read_file: ['read', filePath('file_path')],
  read_many_files: ['read'],
  list_directory: ['read', filePath('dir_path')],
  glob: ['search', search],
  grep_search: ['search', search],
  search_file_content: ['search', search],
  write_file: ['edit', filePath('file_path')],
  replace: ['edit', filePath('file_path')],
  web_fetch: ['fetch', promptUrl],
  google_web_search: ['web_search', (args) => asString(args.query)],
  write_todos: ['todo', (args) => planProgress(args.todos, (todo) => todo.status === 'completed')],
  invoke_agent: ['agent'],
  ask_user: ['ask'],
};

/**
 * MCP tools are named `mcp_<server>_<tool>`; the adapter registers Pitchcrew's server as
 * `pitchcrew`, so its connector tools (github_…, gmail_…) match too.
 */
const pitchcrewPrefix = 'mcp_pitchcrew_';

const describe = (name: string, args: Args, cwd: string): Call => {
  if (name.startsWith(pitchcrewPrefix))
    return { kind: 'mcp', pitchcrew: name.slice(pitchcrewPrefix.length) };
  if (Object.hasOwn(builtIns, name)) {
    const [kind, detail] = builtIns[name];
    return { kind, detail: detail?.(args, cwd) };
  }
  // Another server's tool shows its name only, never its arguments.
  return name.startsWith('mcp_') ? { kind: 'mcp', detail: name.slice(4) } : { kind: 'other' };
};

/** Error types for calls Gemini refused itself, before any tool or server ran. */
const refusals: Record<string, ToolFailureReason> = {
  policy_violation: 'not_allowed',
  tool_not_registered: 'not_found',
  invalid_tool_params: 'invalid_input',
};

/**
 * The raw MCP result Gemini appends to an `mcp_tool_error` message (`… with response: [<parts>]`).
 * It comes last, after the call's arguments.
 */
const embeddedResponse = (message: string) => {
  const marker = ' with response: ';
  const at = message.lastIndexOf(`${marker}[`);
  if (at < 0) return undefined;
  try {
    const parts: unknown = JSON.parse(message.slice(at + marker.length));
    const part = asRecord(Array.isArray(parts) ? parts[0] : undefined);
    return asRecord(asRecord(part?.functionResponse)?.response);
  } catch {
    return undefined;
  }
};

/**
 * Gemini's `mcp_tool_error` message embeds the call's arguments and raw result, so it only
 * classifies the failure and the step shows a fixed sentence. An error from Gemini's MCP client
 * (timeout, transport) or from the server's SDK (arguments, unknown tool) means Pitchcrew's daemon
 * never answered; any other result is the daemon's own answer, which the gateway records.
 */
const mcpFailure = (message: string): Outcome => {
  const response = embeddedResponse(message);
  const content = contentText(response?.content);
  const refusal =
    asString(asRecord(response?.error)?.message) ??
    (preGatewayFailure(content) ? content : undefined);
  return refusal
    ? { failed: true, failure: nativeFailureReason(refusal), preGateway: true }
    : { failed: true, failure: 'tool_error', preGateway: false };
};

const failure = (error: Args | undefined, output: string | undefined): Outcome => {
  const type = asString(error?.type);
  const message = asString(error?.message);
  if (type === 'mcp_tool_error') return mcpFailure(message ?? '');
  // An unknown tool's message also suggests every registered one.
  const reason = (message ?? output)?.replace(/\s*Did you mean[\s\S]*$/, '');
  return type && Object.hasOwn(refusals, type)
    ? { failed: true, reason, failure: refusals[type], preGateway: true }
    : { failed: true, reason };
};

/**
 * Gemini's stream-json `tool_use` starts a call and `tool_result` finishes it by `tool_id` alone.
 * A command's non-zero exit arrives as a success whose output names the code, so it stays done.
 */
export const geminiCliTools: NativeToolParser =
  ({ cwd }) =>
  (event) => {
    const callId = asString(event.tool_id);
    if (!callId) return [];
    if (event.type === 'tool_use') {
      const name = asString(event.tool_name);
      const args = asRecord(event.parameters) ?? {};
      return name ? [{ phase: 'start', callId, ...describe(name, args, cwd) }] : [];
    }
    if (event.type !== 'tool_result') return [];
    if (event.status === 'success') return [{ phase: 'finish', callId, failed: false }];
    return event.status === 'error'
      ? [{ phase: 'finish', callId, ...failure(asRecord(event.error), asString(event.output)) }]
      : [];
  };
