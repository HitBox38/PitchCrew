import {
  activityLimits,
  activityLine,
  crewActionForTool,
  crewToolLabelsFor,
  isActivityToolKind,
  isReviewedMcpTool,
  nativeFailureReason,
  nativeToolLabels,
  preGatewayFailure,
  redactValues,
  runtimeStepId,
  toolFailureDescriptions,
  type ActivityToolKind,
  type ChatContext,
  type RunContext,
  type RuntimeActivity,
  type ToolFailureReason,
} from '@pitchcrew/core';
import { homedir } from 'node:os';
import { isAbsolute, relative, sep } from 'node:path';
import { runtimeConnectionSecretNames } from '../process/runtime-connection-fields.ts';

/**
 * A runtime's own tool call, normalized by its parser. Provider event shapes stay in each
 * runtime's `tools.ts`; this tracker turns them into activity steps.
 */
export interface NativeToolStart {
  phase: 'start';
  /** The runtime's call id, stable from start to finish. */
  callId: string;
  kind: ActivityToolKind;
  /**
   * One line naming the target: a command, path, pattern, URL (origin and path) or query.
   * Redacted again here. Never built from the arguments of a Pitchcrew tool call.
   */
  detail?: string;
  /** The bare MCP tool name when the call goes to Pitchcrew's own server (any of its tools). */
  pitchcrew?: string;
}
export interface NativeToolFinish {
  phase: 'finish';
  callId: string;
  failed: boolean;
  /** Stopped by the user or the runtime rather than failed; shown as interrupted. */
  interrupted?: boolean;
  /** The runtime's failure text. Redacted and shortened here; never sent to diagnostics. */
  reason?: string;
  /** A closed reason when the runtime states one; otherwise derived from the text. */
  failure?: ToolFailureReason;
  /**
   * The call failed before Pitchcrew's daemon received it (MCP validation, unknown tool, the
   * runtime's own timeout or transport). Derived from the text when absent.
   */
  preGateway?: boolean;
  /**
   * Runtimes that only report finished calls describe the call here instead of in a start. A
   * started call keeps the description from its start.
   */
  kind?: ActivityToolKind;
  detail?: string;
  pitchcrew?: string;
}
export type NativeToolEvent = NativeToolStart | NativeToolFinish;
/** Where the runtime runs; paths inside it display relative to it. */
export interface NativeToolScope {
  cwd: string;
}
/** One parser per run: it may keep state, such as call ids that a finish event omits. */
export type NativeToolParser = (
  scope: NativeToolScope,
) => (event: Record<string, unknown>) => NativeToolEvent[];

/** The runtime's working directory, as the launcher chooses it. */
export const runtimeDirectory = (context: RunContext | ChatContext) =>
  !context.purpose && 'session' in context && context.session
    ? context.session.directory
    : context.directory;

/** Secret values in a runtime's spawn environment, selected like the stderr redactor's. */
export const environmentSecrets = (environment: Record<string, string | undefined>) =>
  Object.entries(environment)
    .filter(
      ([key, value]) =>
        !!value &&
        value.length >= 4 &&
        (runtimeConnectionSecretNames.has(key) || /KEY|TOKEN|SECRET|PASSWORD|AUTH/i.test(key)),
    )
    .map(([, value]) => value!);

/** A path relative to the run folder, or to the home folder, when it is inside one. */
export const displayPath = (path: string, cwd?: string) => {
  if (!isAbsolute(path)) return path;
  if (cwd && (path === cwd || path.startsWith(cwd + sep))) return relative(cwd, path) || '.';
  const home = homedir();
  if (path === home) return '~';
  return path.startsWith(home + sep) ? `~${sep}${relative(home, path)}` : path;
};

/**
 * A web address as origin and path, without credentials, query or fragment. Other schemes keep
 * only their name: a data: or mailto: address is content, not a place.
 */
export const displayUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (!/^(?:https?|wss?):$/.test(url.protocol)) return url.protocol;
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return value.split(/[?#]/)[0];
  }
};

/** An object field of an untrusted runtime event. */
export const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
/** A non-empty string field of an untrusted runtime event. */
export const asString = (value: unknown) =>
  typeof value === 'string' && value ? value : undefined;

/** The text of MCP-style content: a string, or `{type: 'text'}` blocks. Images are skipped. */
export const contentText = (content: unknown): string =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .flatMap((block) => {
            const part = asRecord(block);
            return part?.type === 'text' && typeof part.text === 'string' ? [part.text] : [];
          })
          .join('\n')
      : '';

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * A command as a person would type it: the first line, without the `bash -lc '…'` wrapper some
 * runtimes run every command through.
 */
export const commandLine = (command: string) => {
  const wrapped = /^(?:\S*\/)?(?:ba|z)?sh\s+-l?c\s+([\s\S]+)$/.exec(command.trim())?.[1]?.trim();
  const script = wrapped ? (/^(['"])([\s\S]*)\1$/.exec(wrapped)?.[2] ?? wrapped) : command;
  return lines(script)[0] ?? '';
};

/** Why a command failed: its exit code and the last line it printed, where errors usually are. */
export const exitReason = (code: number, output = '') => {
  const last = lines(output).at(-1);
  return last ? `Exit code ${code}: ${last}` : `Exit code ${code}`;
};

/** A plan's progress, such as "2/5 done". Undefined when the runtime sent no list. */
export const planProgress = (steps: unknown, done: (step: Record<string, unknown>) => boolean) =>
  Array.isArray(steps)
    ? `${steps.filter((step) => !!asRecord(step) && done(step)).length}/${steps.length} done`
    : undefined;

/**
 * The detail of a built-in tool from its input, for runtimes whose tools share Claude Code's
 * shape (`command`, `file_path` or `filePath`, `pattern` and `path`, `url`, `query`,
 * `description`, `todos`). Never used for Pitchcrew calls.
 */
export const inputDetail = (
  kind: ActivityToolKind,
  input: Record<string, unknown>,
  cwd: string,
) => {
  switch (kind) {
    case 'command': {
      const command = asString(input.command);
      return command && commandLine(command);
    }
    case 'read':
    case 'edit': {
      const path =
        asString(input.file_path) ?? asString(input.filePath) ?? asString(input.notebook_path);
      return path && displayPath(path, cwd);
    }
    case 'search': {
      const pattern = asString(input.pattern) ?? asString(input.query);
      const path = asString(input.path);
      const where = path && displayPath(path, cwd);
      return pattern && where ? `${pattern} in ${where}` : (pattern ?? where);
    }
    case 'fetch': {
      const url = asString(input.url);
      return url && displayUrl(url);
    }
    case 'web_search':
      return asString(input.query);
    case 'agent':
      return asString(input.description);
    case 'todo':
      return planProgress(input.todos, (todo) => todo.status === 'completed');
  }
  return undefined;
};

interface Call {
  kind: ActivityToolKind;
  detail?: string;
  pitchcrew?: string;
}

/**
 * Turns normalized native calls into steps. Calls to Pitchcrew's own server are left to the
 * daemon gateway, which records each one it receives with its reason; only a Pitchcrew call that
 * failed before reaching the daemon becomes a step here.
 */
export const nativeToolTracker = (
  emit: (entry: RuntimeActivity) => void,
  secrets: readonly string[] = [],
) => {
  const calls = new Map<string, Call>();
  // Exact values first: collapsing whitespace or shortening could split a secret.
  const clean = (text: string | undefined, max: number) =>
    text ? activityLine(redactValues(text, secrets), max) : undefined;
  // Parsers read untrusted streams; a missed lookup becomes a generic step rather than a throw.
  const kindOf = (kind: unknown): ActivityToolKind => (isActivityToolKind(kind) ? kind : 'other');
  /**
   * Why a call that shows as failed failed: its closed reason, and its sentence, which is the
   * runtime's cleaned text unless `fixedText` asks for the reason's own description. Computed only
   * for steps that show, so finishes left to the gateway are never cleaned.
   */
  const failureOf = (event: NativeToolFinish, fixedText = false) => {
    const reason = event.failure ?? nativeFailureReason(event.reason ?? '');
    const text = fixedText ? undefined : clean(event.reason, activityLimits.error);
    return { reason, error: text ?? toolFailureDescriptions[reason] };
  };
  /**
   * A Pitchcrew call that never reached the daemon. It never ran, so an unrecognized failure is
   * unclassified rather than the tool's own error, and like the gateway's validation summaries
   * its text never names the keys the model sent (the MCP SDK lists unrecognized ones, one issue
   * per line, so they are rewritten before the text becomes one line).
   */
  const unreachedFailure = (event: NativeToolFinish, fixedText: boolean) => {
    const reason = event.reason?.replace(/Unrecognized keys?: [^\n]*/g, 'Unexpected field');
    const failure =
      event.failure ??
      (nativeFailureReason(reason ?? '') === 'tool_error' ? ('unclassified' as const) : undefined);
    return failureOf({ ...event, reason, failure }, fixedText);
  };
  return (event: NativeToolEvent) => {
    if (typeof event.callId !== 'string' || !event.callId) return;
    if (event.phase === 'start') {
      if (calls.has(event.callId)) return;
      const kind = kindOf(event.kind);
      const call: Call = event.pitchcrew
        ? { kind, pitchcrew: event.pitchcrew }
        : { kind, detail: clean(event.detail, activityLimits.detail) };
      calls.set(event.callId, call);
      // Bounded: a long turn keeps only recent unfinished calls.
      if (calls.size > 256) calls.delete(calls.keys().next().value!);
      if (call.pitchcrew) return;
      emit({
        id: runtimeStepId(event.callId),
        kind: 'tool',
        tool: call.kind,
        label: nativeToolLabels[call.kind].running,
        ...(call.detail ? { detail: call.detail } : {}),
        status: 'running',
      });
      return;
    }
    const known = calls.get(event.callId);
    calls.delete(event.callId);
    const pitchcrew = known?.pitchcrew ?? event.pitchcrew;
    // A finish without its start may be a Pitchcrew call whose start was skipped: unless the
    // runtime describes the call in its finish, leave it to the gateway.
    if (!known && event.kind === undefined && !pitchcrew) return;
    if (pitchcrew) {
      if (!event.failed || event.interrupted) return;
      if (!(event.preGateway ?? preGatewayFailure(event.reason ?? ''))) return;
      const action = crewActionForTool(pitchcrew);
      const labels = crewToolLabelsFor(action ?? '');
      // Runtime text about a browser call can quote typed values, addresses or selectors: like
      // the gateway's browser steps, it shows only a fixed sentence for its reason.
      const { reason, error } = unreachedFailure(event, labels.tool === 'browser');
      emit({
        id: runtimeStepId(event.callId),
        kind: 'tool',
        // A name Pitchcrew does not publish is still a call to its MCP server.
        tool: action ? labels.tool : 'mcp',
        label: labels.failed,
        status: 'failed',
        error,
        failure: { reason, ...(isReviewedMcpTool(pitchcrew) ? { tool: pitchcrew } : {}) },
      });
      return;
    }
    const kind = known?.kind ?? kindOf(event.kind);
    const detail = known ? known.detail : clean(event.detail, activityLimits.detail);
    const labels = nativeToolLabels[kind];
    const step = {
      id: runtimeStepId(event.callId),
      kind: 'tool' as const,
      tool: kind,
      ...(detail ? { detail } : {}),
    };
    if (event.interrupted) emit({ ...step, label: labels.running, status: 'interrupted' });
    else if (!event.failed) emit({ ...step, label: labels.done, status: 'completed' });
    else {
      const { reason, error } = failureOf(event);
      emit({ ...step, label: labels.failed, status: 'failed', error, failure: { reason } });
    }
  };
};
