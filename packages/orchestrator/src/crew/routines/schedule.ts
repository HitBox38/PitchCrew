import { routineInput, type RoutineInput } from '@pitchcrew/core';
import { CronExpressionParser } from 'cron-parser';

export function parseRoutine(data: unknown): RoutineInput {
  const input = routineInput.parse(data);
  input.startAt = new Date(input.startAt).toISOString();
  if (input.endsAt) input.endsAt = new Date(input.endsAt).toISOString();
  try {
    new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format();
  } catch {
    throw new Error('Choose a valid IANA timezone, such as Asia/Jerusalem.');
  }
  if (input.cron) {
    if (input.cron.split(/\s+/).length !== 5 || /H/.test(input.cron))
      throw new Error(
        'Use a deterministic five-field cron expression (minute hour day month weekday).',
      );
    CronExpressionParser.parse(input.cron, {
      tz: input.timezone,
      currentDate: input.startAt,
    }).next();
  }
  return input;
}

/** First occurrence at/after start, or the next occurrence strictly after a dispatch. */
export function nextOccurrence(input: RoutineInput, after?: string): string | null {
  const start = Date.parse(input.startAt);
  let next: number;
  if (input.cron) {
    next = CronExpressionParser.parse(input.cron, {
      tz: input.timezone,
      currentDate: new Date(Math.max(start - 1, after ? Date.parse(after) : start - 1)),
    })
      .next()
      .toDate()
      .getTime();
  } else if (input.intervalMinutes) {
    const interval = input.intervalMinutes * 60000;
    next = after
      ? start + Math.max(0, Math.floor((Date.parse(after) - start) / interval) + 1) * interval
      : start;
  } else {
    next = after ? Number.POSITIVE_INFINITY : start;
  }
  if (!Number.isFinite(next) || (input.endsAt && next > Date.parse(input.endsAt))) return null;
  return new Date(next).toISOString();
}
