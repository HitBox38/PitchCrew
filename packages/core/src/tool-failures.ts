/**
 * Why a tool call failed, as a closed vocabulary. The readable reason a person sees stays in the
 * turn's activity; diagnostics only ever carry these fixed words. No imports, so the daemon,
 * adapters and renderer can share it without cycles or zod.
 */
export const toolFailureReasons = Object.freeze([
  /** The arguments were rejected (schema or validation). */
  'invalid_input',
  /** The run, role or capability is not permitted to use the tool or action. */
  'not_allowed',
  /** Something the tool needed no longer exists. */
  'not_found',
  /** The data changed while the tool ran, or the move is not allowed from the current state. */
  'conflict',
  /** The action needs an exact approval that was not available. */
  'approval_required',
  /** A per-run or per-account limit was reached. */
  'limit_reached',
  /** An account, runtime or browser needs setting up or reconnecting. */
  'setup_required',
  /** Any other deliberate refusal by Pitchcrew. */
  'rejected',
  /** The tool ran and reported a failure (for example a non-zero exit). */
  'tool_error',
  /** The tool did not finish in time. */
  'timeout',
  /** A service the tool depends on was unreachable. */
  'unavailable',
  /** A programming or storage fault inside Pitchcrew. */
  'internal',
  /** No recognizable shape. */
  'unclassified',
  /** The user declined the request; shown as their choice, never as a failure. */
  'declined',
  /** The user held the browser; the call paused rather than failed. */
  'user_control',
  /** The run was stopped. */
  'cancelled',
] as const);
export type ToolFailureReason = (typeof toolFailureReasons)[number];

const reasons = new Set<string>(toolFailureReasons);
export const isToolFailureReason = (value: unknown): value is ToolFailureReason =>
  typeof value === 'string' && reasons.has(value);

/** The user's own choices and stopped runs: shown in chat, never reported as tool failures. */
export const userToolOutcomes: readonly ToolFailureReason[] = Object.freeze([
  'declined',
  'user_control',
  'cancelled',
]);
export const reportableToolFailure = (reason: ToolFailureReason) =>
  !userToolOutcomes.includes(reason);

/** Faults in Pitchcrew or what it depends on, as opposed to deliberate refusals. */
export const toolFaultReasons: readonly ToolFailureReason[] = Object.freeze([
  'timeout',
  'unavailable',
  'internal',
  'unclassified',
]);

/** Repository-owned sentences, safe for diagnostics and as a fallback reason in chat. */
export const toolFailureDescriptions: Readonly<Record<ToolFailureReason, string>> = Object.freeze({
  invalid_input: 'The tool rejected the arguments it was given.',
  not_allowed: 'This run is not allowed to use that tool or action.',
  not_found: 'Something the tool needed no longer exists.',
  conflict: 'The data changed while the tool was running.',
  approval_required: 'The action needs your approval first.',
  limit_reached: 'A limit for this run was reached.',
  setup_required: 'An account, runtime or browser needs setting up.',
  rejected: 'Pitchcrew refused the request.',
  tool_error: 'The tool ran and reported a failure.',
  timeout: 'The tool did not finish in time.',
  unavailable: 'A service the tool depends on was unavailable.',
  internal: 'Pitchcrew hit an internal error.',
  unclassified: 'The tool failed for an unrecognized reason.',
  declined: 'You declined the request.',
  user_control: 'The call paused while you had control.',
  cancelled: 'The run was stopped.',
});
