import { dayLabel } from '@/ActivityPage/history.ts';
import type { SinceLine, SinceTarget, SinceWindow } from '@/lib/since.ts';

export type SinceDay = { label: string; lines: SinceLine[] };

/**
 * Newest-first lines grouped by local day ("Today", "Yesterday", a date), keeping their order.
 * Never split into "overnight" or "while you were away": nothing records when the user left.
 */
export const sinceDays = (lines: readonly SinceLine[], now: number): SinceDay[] => {
  const today = new Date(now);
  const days: SinceDay[] = [];
  for (const line of lines) {
    const label = dayLabel(line.at, today);
    const last = days.at(-1);
    if (last?.label === label) last.lines.push(line);
    else days.push({ label, lines: [line] });
  }
  return days;
};

/** Where a line leads, said after it: its row in Needs you, the job, the conversation, Pipeline. */
export const sinceHint = (target: SinceTarget) => {
  if (!target) return '';
  if ('item' in target) return 'In Needs you';
  if ('cardId' in target) return 'Job details';
  if ('thread' in target) return 'Conversation';
  return target.to === '/pipeline' ? 'Pipeline' : '';
};

/**
 * The Needs you heading's button: "Since you were last here: 3 finished · 2 new asks", or
 * "Since 22:20" where it must fit beside the heading (a phone, a narrow desk).
 */
export const sinceButtonWords = (summary: string, range: SinceWindow) => ({
  long: summary || 'nothing recorded',
  short: `Since ${range.time}`,
});

/**
 * The window's tooltip: only a stored visit was "last opened"; the default has no visit behind it,
 * and a capped window starts seven days back, not at the visit.
 */
export const sinceWindowTitle = (range: SinceWindow) => {
  if (range.kind === 'default') return undefined;
  return range.kind === 'capped'
    ? 'Last opened on this device more than 7 days ago'
    : 'Last opened on this device';
};
