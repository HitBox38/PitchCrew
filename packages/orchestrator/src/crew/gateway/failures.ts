import {
  activityLimits,
  activityLine,
  isUserControlError,
  isUserDeclinedError,
  LifecycleError,
  redactValues,
  toolFailureDescriptions,
  userToolOutcomes,
  type ToolFailureReason,
} from '@pitchcrew/core';
import { QueueBusyError } from '../queue/admission.ts';

/** Why a gateway call failed: a closed reason, and the sentence its step shows. */
export interface ToolFailure {
  reason: ToolFailureReason;
  /** Shown to the user and saved with the turn. Absent for the user's own outcomes. */
  message?: string;
}

/** Browser tools can fail with Playwright text: typed values, URLs, selectors and call logs. */
const browserTool = (action: string) =>
  action.startsWith('computer_') || action === 'assess_form' || action === 'capture_submission';

/**
 * A browser failure never shows its own text, only one of these. Internal errors and the user's
 * own outcomes keep the shared descriptions.
 */
const browserMessages: Readonly<Record<ToolFailureReason, string>> = {
  ...toolFailureDescriptions,
  invalid_input: 'The browser request had invalid details.',
  not_allowed: "This agent isn't allowed to do that in the browser.",
  not_found: 'The page or element could not be found.',
  conflict: 'The page or its approval changed before the step could run.',
  approval_required: 'The step needs your approval first.',
  limit_reached: 'The browser was busy with another step.',
  setup_required: 'The browser needs setting up first.',
  rejected: 'The browser could not carry out this step.',
  tool_error: 'The browser reported an error.',
  timeout: 'The page did not respond in time.',
  unavailable: 'The browser could not be reached.',
  unclassified: 'The browser step failed for an unrecognized reason.',
};
const unreachable = 'A service the tool depends on could not be reached.';
const localFile = 'A local file could not be read or written.';

const networkCodes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
]);
const fileReasons: Readonly<Record<string, ToolFailureReason>> = {
  ENOENT: 'not_found',
  EACCES: 'not_allowed',
  EPERM: 'not_allowed',
};

const errorCode = (value: unknown) => {
  const code = (value as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
};
/** Node and Bun system errors ("ENOENT"): their messages name local paths or hosts. */
const systemCode = (code: string | undefined) =>
  code && /^E(?!RR_)[A-Z0-9_]+$/.test(code) ? code : undefined;
/** Node's fetch reports an unreachable host as a TypeError caused by the system error. */
const networkFailure = (error: Error) =>
  error instanceof TypeError &&
  (error.message === 'fetch failed' || networkCodes.has(errorCode(error.cause) ?? ''));

const statusReason = (status: unknown): ToolFailureReason | undefined => {
  if (typeof status !== 'number') return undefined;
  if (status === 400) return 'invalid_input';
  if (status === 401 || status === 403) return 'not_allowed';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'limit_reached';
  return status >= 500 && status <= 599 ? 'unavailable' : undefined;
};

/**
 * Pitchcrew's own refusals are plain errors that their wording tells apart ("… is disabled for
 * your role.", "Three proposals maximum per run."). The first match wins, so more specific
 * wording comes first: a connection that did not happen is a fault before any setup words ("The
 * native browser tab did not connect.", Bun's "Unable to connect."). Setup is a sentence that
 * tells the user to install, connect or sign in ("GitHub CLI account changed. Reconnect …"), or
 * says something is not set up; a sentence that only mentions installing is another refusal.
 */
const wordedReasons: readonly (readonly [ToolFailureReason, RegExp])[] = [
  ['unavailable', /\b(?:did not|unable to|could not|couldn't|cannot|can't|failed to) connect\b/i],
  [
    'setup_required',
    /(?:^|[!.?]\s+)(?:install|connect|reconnect|sign in)\b|\b(?:is|are) not (?:installed|connected|signed in)\b|expired or revoked|was revoked|account is disconnected/i,
  ],
  [
    'unavailable',
    /\b(?:could not reach|couldn't reach|unreachable|disconnected|desktop browser is unavailable)\b/i,
  ],
  [
    'limit_reached',
    /\b(?:maximum|at most|too many|too large|limit|exceeds?|in progress|is being|still finishing)\b/i,
  ],
  [
    'conflict',
    /\b(?:changed|concurrently|already|no longer (?:pending|available)|stale|cannot (?:go|move))\b/i,
  ],
  [
    'not_found',
    /\b(?:not found|no longer exists|was deleted|were removed|is missing|are missing)\b/i,
  ],
  ['approval_required', /\b(?:approval|approve)\b/i],
  [
    'not_allowed',
    /\b(?:not allowed|not enabled|not available|disabled|permissions?|cannot|can only|only (?:the|a direct)|access denied|access was removed|scoped to|is paused|retired|requires? an active|invalid or expired)\b/i,
  ],
];
const wordedReason = (message: string): ToolFailureReason => {
  // Connector HTTP failures name their status: "Connector request failed (503). …"
  const status = statusReason(Number(/\bfailed \((\d{3})\)/.exec(message)?.[1]));
  return status ?? wordedReasons.find(([, words]) => words.test(message))?.[0] ?? 'rejected';
};

/**
 * A refusal's first non-blank line, before any Playwright "Call log:". Later lines can quote page
 * or packet content (element previews, typed values, packet check findings), so neither the
 * sentence shown nor the reason comes from them.
 */
const firstLine = (message: string) =>
  message
    .split('Call log:')[0]!
    .split('\n')
    .find((part) => part.trim());

const failureReason = (error: unknown, aborted: boolean): ToolFailureReason => {
  // The user's own outcomes count wherever the message names them.
  const text = error instanceof Error ? error.message : '';
  if (isUserDeclinedError(text)) return 'declined';
  if (isUserControlError(text)) return 'user_control';
  if (aborted || (error as { name?: unknown } | null)?.name === 'AbortError') return 'cancelled';
  if (!(error instanceof Error)) return 'unclassified';
  if (error.name === 'ZodError') return 'invalid_input';
  const line = firstLine(text) ?? '';
  const code = errorCode(error);
  if (error.name === 'TimeoutError' || code === 'ETIMEDOUT' || /\btimed out\b/i.test(line))
    return 'timeout';
  const status = statusReason((error as { statusCode?: unknown }).statusCode);
  if (status) return status;
  // ProfileConflictError carries statusCode 409, so it is already a conflict above.
  if (error instanceof LifecycleError) return 'conflict';
  if (error instanceof QueueBusyError) return 'limit_reached';
  if (code?.startsWith('SQLITE_')) return 'internal';
  const system = systemCode(code);
  if (system) return networkCodes.has(system) ? 'unavailable' : (fileReasons[system] ?? 'internal');
  if (networkFailure(error)) return 'unavailable';
  if (
    error instanceof TypeError ||
    error instanceof ReferenceError ||
    error instanceof RangeError ||
    error instanceof SyntaxError
  )
    return 'internal';
  return wordedReason(line);
};

const identifier = /^[A-Za-z_$][\w$]{0,63}$/;
/**
 * "<issue> at <path>", as the MCP SDK words validation errors. The path stops at the first
 * segment that is neither an index nor an identifier (a record key can be anything), and
 * unrecognized keys are never named.
 */
const issueText = (issue: { code?: unknown; message?: unknown; path?: unknown }) => {
  const message =
    issue.code === 'unrecognized_keys'
      ? 'Unexpected field'
      : (activityLine(issue.message, 120) ?? 'Invalid value');
  const segments: unknown[] = Array.isArray(issue.path) ? issue.path : [];
  const end = segments.findIndex(
    (segment) => typeof segment !== 'number' && !identifier.test(String(segment)),
  );
  const path = (end === -1 ? segments : segments.slice(0, end)).join('.');
  return path ? `${message} at ${path}` : message;
};
const issueSummary = (error: Error) => {
  const issues: unknown = (error as { issues?: unknown }).issues;
  if (!Array.isArray(issues) || !issues.length) return undefined;
  const more = issues.length > 2 ? ` (+${issues.length - 2} more)` : '';
  return activityLine(
    `${issues.slice(0, 2).map(issueText).join('; ')}${more}`,
    activityLimits.error,
  );
};

/** The sentence a refusal shows: its first line, without the run token, redacted and bounded. */
const errorLine = (message: string, secrets: readonly string[]) => {
  const line = firstLine(message);
  return line ? activityLine(redactValues(line, secrets), activityLimits.error) : undefined;
};

const failureMessage = (error: unknown, reason: ToolFailureReason, secrets: readonly string[]) => {
  if (!(error instanceof Error)) return toolFailureDescriptions[reason];
  // System errors name local paths and hosts: say only what kind of thing failed.
  const code = systemCode(errorCode(error));
  if ((code && networkCodes.has(code)) || networkFailure(error)) return unreachable;
  if (code) return localFile;
  if (reason === 'internal') return toolFailureDescriptions.internal;
  const text = error.name === 'ZodError' ? issueSummary(error) : errorLine(error.message, secrets);
  return text ?? toolFailureDescriptions[reason];
};

/**
 * Classifies a failed gateway call. `aborted` says the run was stopped meanwhile; `secrets` are
 * exact values (the run's token) the sentence must never contain. Pure: the same error always
 * gives the same reason and sentence.
 */
export const classifyToolFailure = (
  action: string,
  error: unknown,
  aborted: boolean,
  secrets: readonly string[] = [],
): ToolFailure => {
  const reason = failureReason(error, aborted);
  if (userToolOutcomes.includes(reason)) return { reason };
  return {
    reason,
    message: browserTool(action) ? browserMessages[reason] : failureMessage(error, reason, secrets),
  };
};
