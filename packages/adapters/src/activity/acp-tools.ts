import { isReviewedMcpTool, type ActivityToolKind } from '@pitchcrew/core';
import {
  asRecord,
  asString,
  commandLine,
  contentText,
  displayPath,
  displayUrl,
  type NativeToolEvent,
  type NativeToolFinish,
  type NativeToolParser,
  type NativeToolStart,
} from './native-tools.ts';

type Fields = Record<string, unknown>;
type Call = Omit<NativeToolStart, 'phase' | 'callId'>;
type Outcome = Omit<NativeToolFinish, 'phase' | 'callId'>;

/** ACP tool kinds. `think` steps are the agent's private reasoning and never become steps. */
const kinds = new Map<string, ActivityToolKind>(
  Object.entries({
    execute: 'command',
    read: 'read',
    edit: 'edit',
    delete: 'edit',
    move: 'edit',
    search: 'search',
    fetch: 'fetch',
  } as const),
);
/** The fields that describe a call; a `tool_call_update` repeats only those that changed. */
const describing = ['title', 'name', 'toolName', 'kind', 'rawInput', 'locations'];

/** A nested field of an untrusted update, such as `_meta.kiro.failureReason`. */
const at = (value: unknown, ...keys: string[]) =>
  keys.reduce<unknown>((current, key) => asRecord(current)?.[key], value);

interface Target {
  server: string;
  tool: string;
}
/**
 * Kiro's own identity for an MCP call: CLI v3's `_meta.kiro.mcpTool.identity`, else the v2
 * engine's `_meta.kiro.mcpServerName` and `toolName`. A v2 built-in tool names no server.
 */
const kiroTarget = (update: Fields): Target | undefined => {
  const kiro = at(update, '_meta', 'kiro');
  const server =
    asString(at(kiro, 'mcpTool', 'identity', 'serverName')) ?? asString(at(kiro, 'mcpServerName'));
  const tool =
    asString(at(kiro, 'mcpTool', 'identity', 'toolName')) ?? asString(at(kiro, 'toolName'));
  return server && tool ? { server, tool } : undefined;
};
/**
 * An MCP call by its name: Kiro titles them `@server/tool` (`Running: @server/tool` on its v2
 * engine) and Grok names them `server__tool`, as the tool itself or as the target of its
 * `use_tool` helper. The `mcp__server__tool` form other agents use is read too, so a Pitchcrew
 * call is never mistaken for a native one.
 */
const namedTarget = (fields: Fields): Target | undefined => {
  const names = [at(fields, 'rawInput', 'tool_name'), fields.name, fields.toolName, fields.title];
  for (const name of names) {
    // Tool names and MCP titles are short; capping the text also caps this match's backtracking.
    const value = asString(name)?.trim() ?? '';
    if (value.length > 256) continue;
    const match = /^(?:(?:Running: )?@([^/\s]+)\/(\S+)|(?:mcp__)?([^\s/@_][^\s/@]*?)__(\S+))$/.exec(
      value,
    );
    if (match) return { server: match[1] ?? match[3], tool: match[2] ?? match[4] };
  }
  return undefined;
};

const nameOf = (fields: Fields) =>
  asString(fields.name) ?? asString(fields.toolName) ?? asString(fields.title);

const detailFor = (kind: ActivityToolKind, fields: Fields, cwd: string) => {
  const input = asRecord(fields.rawInput) ?? {};
  const location = Array.isArray(fields.locations)
    ? asString(asRecord(fields.locations[0])?.path)
    : undefined;
  const path = location ?? asString(input.path) ?? asString(input.file_path);
  const where = path && displayPath(path, cwd);
  switch (kind) {
    case 'command': {
      const command = asString(input.command) ?? asString(input.cmd);
      return command && commandLine(command);
    }
    case 'read':
    case 'edit':
      return where;
    case 'search': {
      const pattern = asString(input.pattern) ?? asString(input.query);
      return pattern && where ? `${pattern} in ${where}` : (pattern ?? where);
    }
    case 'fetch': {
      const url = asString(input.url);
      return url && displayUrl(url);
    }
  }
  return undefined;
};

interface Tracked {
  fields: Fields;
  /** Kept from the update that carried it: later updates need not repeat it. */
  target?: Target;
  /** The latest text the call produced, since a failed update may not repeat its content. */
  output?: string;
  /** The latest status: a `tool_call_update` repeats it only when it changes. */
  status?: unknown;
  started: boolean;
}

/** A call's kind and target, or undefined until an update names it. */
const describe = ({ fields, target }: Tracked, cwd: string): Call | undefined => {
  const name = nameOf(fields);
  // A Pitchcrew call carries only its tool name: its arguments hold the user's own data. An
  // agent may also title such a call with the bare tool name.
  if (target?.server === 'pitchcrew') return { kind: 'mcp', pitchcrew: target.tool };
  if (name && isReviewedMcpTool(name)) return { kind: 'mcp', pitchcrew: name };
  if (target) return { kind: 'mcp', detail: `${target.tool} (${target.server})` };
  if (!name) return undefined;
  const kind = kinds.get(asString(fields.kind) ?? '') ?? 'other';
  return { kind, detail: detailFor(kind, fields, cwd) ?? asString(fields.title) ?? name };
};

/** Text a call produced: its text content, else an error in its raw output. Never images. */
const outputText = (update: Fields) => {
  const blocks = Array.isArray(update.content)
    ? update.content.flatMap((item) =>
        at(item, 'type') === 'content' ? [at(item, 'content')] : [],
      )
    : [];
  return (
    asString(contentText(blocks).trim()) ??
    asString(update.rawOutput) ??
    asString(at(update, 'rawOutput', 'error')) ??
    asString(at(update, 'rawOutput', 'message')) ??
    asString(at(update, 'rawOutput', 'stderr'))
  );
};

/** How a settled call ended. Kiro states why a call failed; a denied call never ran. */
const outcomeOf = (update: Fields, output: string | undefined): Outcome => {
  const why = at(update, '_meta', 'kiro', 'failureReason');
  if (update.status === 'cancelled' || why === 'cancelled')
    return { failed: false, interrupted: true };
  if (update.status !== 'failed') return { failed: false };
  return {
    failed: true,
    ...(output ? { reason: output } : {}),
    ...(why === 'denied' ? { failure: 'not_allowed', preGateway: true } : {}),
  };
};

/**
 * Normalizes ACP `session/update` tool calls (`tool_call` and `tool_call_update`), shared by Kiro
 * (acp.ts) and runtimes whose stream follows ACP. Receives the `update` object.
 *
 * A call is upserted by its id, keeping the fields and status that later updates do not repeat.
 * Its step starts once it runs (or arrives already settled) and has a name: a pending call may
 * still be streaming its input, and a placeholder without a title or name may be named by a later
 * update. `onlyFailures` names helpers worth a step only when they fail; such a step's finish
 * describes the call itself.
 */
export const acpToolParser =
  ({ onlyFailures }: { onlyFailures?: (name: string) => boolean } = {}): NativeToolParser =>
  ({ cwd }) => {
    // Bounded: a long turn keeps only recent unfinished calls, and recent ended ones so that an
    // update repeating an ended call never restarts it.
    const calls = new Map<string, Tracked>();
    const ended = new Set<string>();
    return (update) => {
      const callId = asString(update.toolCallId);
      if (!callId || ended.has(callId)) return [];
      if (!['tool_call', 'tool_call_update'].includes(String(update.sessionUpdate))) return [];
      let call = calls.get(callId);
      if (!call) {
        call = { fields: {}, started: false };
        calls.set(callId, call);
        if (calls.size > 256) calls.delete(calls.keys().next().value!);
      }
      for (const key of describing) if (update[key] != null) call.fields[key] = update[key];
      call.target ??= kiroTarget(update) ?? namedTarget(call.fields);
      call.output = outputText(update) ?? call.output;
      call.status = update.status ?? call.status;
      const settled = ['completed', 'failed', 'cancelled'].includes(String(update.status));
      if (settled) {
        calls.delete(callId);
        ended.add(callId);
        if (ended.size > 256) ended.delete(ended.values().next().value!);
      }
      const description = call.fields.kind === 'think' ? undefined : describe(call, cwd);
      if (!description) return [];
      const quiet = !description.pitchcrew && !!onlyFailures?.(nameOf(call.fields) ?? '');
      const events: NativeToolEvent[] = [];
      if (!call.started && (settled || call.status === 'in_progress')) {
        call.started = true;
        if (!quiet) events.push({ phase: 'start', callId, ...description });
      }
      if (!settled) return events;
      const outcome = outcomeOf(update, call.output);
      if (!quiet) events.push({ phase: 'finish', callId, ...outcome });
      else if (outcome.failed) events.push({ phase: 'finish', callId, ...outcome, ...description });
      return events;
    };
  };

/** Kiro's ACP tool calls. Its agent may use only Pitchcrew's tools; those stay with the gateway. */
export const acpTools = acpToolParser();
