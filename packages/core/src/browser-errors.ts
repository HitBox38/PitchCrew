import stripAnsi from 'strip-ansi';

/** Plain diagnostics for storage and display, including failures saved by older releases. */
export const browserErrorText = (error: string): string => stripAnsi(error);

/**
 * A browser tool call stopped because the user held the page. The agent paused for them; the
 * step is recorded as interrupted with this label rather than failed, and chat neither counts it
 * as a failure nor keeps it as a settled turn's visible issue.
 */
export const userControlPauseLabel = 'Paused while you had control';

/** The scoped browser errors a user takeover produces (see the MCP computer manager). */
export const isUserControlError = (message: string) =>
  /(Manual control (is active|changed|invalidated)|Browser control changed|Browser is controlled in another view)/.test(
    message,
  );

export const isUserControlPause = (entry: { status: string; label: string }) =>
  entry.status === 'interrupted' && entry.label === userControlPauseLabel;

/**
 * The user rejected a browser request (an expired or invalidated one carries its own reason).
 * The agent is told plainly so it neither blames the browser nor retries unasked, and chat shows
 * the decision ("You declined to …") instead of a failed step.
 */
export const userDeclinedError =
  'The user declined this browser action. Do not retry it unless they ask; ask them what to do instead.';

export const isUserDeclinedError = (message: string) => message.includes(userDeclinedError);
