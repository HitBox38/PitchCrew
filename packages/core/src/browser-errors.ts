import stripAnsi from 'strip-ansi';

/** Plain diagnostics for storage and display, including failures saved by older releases. */
export const browserErrorText = (error: string): string => stripAnsi(error);
