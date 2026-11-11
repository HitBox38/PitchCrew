import type { Card, Role, Routine, Run } from '@pitchcrew/core';
import { instantTime, localTime } from './helpers.ts';
import type { RoutineDraft } from './types.ts';

const dayMs = 86400000;

const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * dayMs).toISOString().slice(0, 10);

/** Whether a calendar preset runs on this local date. */
const presetDay = (frequency: RoutineDraft['frequency'], date: string, startDate: string) => {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (frequency === 'daily') return true;
  if (frequency === 'weekdays') return weekday >= 1 && weekday <= 5;
  if (frequency === 'weekly') return weekday === new Date(`${startDate}T12:00:00Z`).getUTCDay();
  return date.slice(8) === startDate.slice(8);
};

/**
 * The first run the daemon schedules for a new or rescheduled draft, mirroring its rule: the first
 * occurrence at or after the start. Custom cron expressions are only computed by the daemon, so
 * they return `undefined`; `null` means there is no run before the end.
 */
export const nextRunPreview = (draft: RoutineDraft): string | null | undefined => {
  if (draft.frequency === 'custom') return undefined;
  const floor = Date.parse(instantTime(draft.startLocal, draft.timezone));
  const end = draft.endLocal ? Date.parse(instantTime(draft.endLocal, draft.timezone)) : Infinity;
  let next = Number.NaN;
  if (draft.frequency === 'once') next = floor;
  else if (draft.frequency === 'interval') {
    const unit = { minutes: 1, hours: 60, days: 1440, weeks: 10080 }[draft.unit];
    if (!(Number(draft.interval) * unit > 0)) return undefined;
    next = floor;
  } else {
    const [startDate, time] = draft.startLocal.split('T');
    const from = localTime(new Date(floor).toISOString(), draft.timezone).slice(0, 10);
    for (let offset = 0; offset < 400 && Number.isNaN(next); offset++) {
      const date = shiftDate(from, offset);
      if (!presetDay(draft.frequency, date, startDate!)) continue;
      try {
        const instant = Date.parse(instantTime(`${date}T${time!.slice(0, 5)}`, draft.timezone));
        if (instant >= floor) next = instant;
      } catch {
        /* Skipped by the daylight-saving change. */
      }
    }
  }
  return Number.isFinite(next) && next <= end ? new Date(next).toISOString() : null;
};

export type RoutineTone = 'plum' | 'ochre' | 'rose' | 'done' | undefined;

/** One word for where the routine stands, and its bead under the shared bead law. */
export const routineStatus = (
  routine: Routine,
  role: Role | undefined,
  lastRun: Run | undefined,
): { label: string; tone: RoutineTone } =>
  lastRun?.status === 'running'
    ? { label: 'Running', tone: 'plum' }
    : routine.error
      ? { label: 'Needs attention', tone: 'rose' }
      : !routine.nextRunAt
        ? { label: 'Finished', tone: 'done' }
        : !routine.enabled
          ? { label: 'Paused', tone: undefined }
          : !role?.enabled
            ? { label: 'Agent paused', tone: 'ochre' }
            : { label: 'Scheduled', tone: undefined };

export const routinesFact = (routines: Pick<Routine, 'enabled' | 'nextRunAt'>[]) => {
  const active = routines.filter((routine) => routine.enabled && routine.nextRunAt).length;
  const paused = routines.filter((routine) => !routine.enabled && routine.nextRunAt).length;
  return `${active} active${paused ? `, ${paused} paused` : ''}`;
};

export const routineJob = (routine: Pick<Routine, 'cardId'>, cards: Card[]) => {
  const card = cards.find((item) => item.id === routine.cardId);
  return card ? `${card.company} — ${card.title}` : routine.cardId ? 'Removed job' : '';
};

export const runLimitLabel = (routine: Pick<Routine, 'runCount' | 'maxRuns'>) =>
  routine.maxRuns
    ? `${routine.runCount} of ${routine.maxRuns} runs`
    : `${routine.runCount} ${routine.runCount === 1 ? 'run' : 'runs'}`;

const scheduleFields = ['startLocal', 'timezone', 'frequency', 'interval', 'unit', 'cron'] as const;

const formatInZone = (instant: string, timezone: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(instant));

/** One sentence for the editor: when the saved routine will next run, in its own timezone. */
export const nextRunSummary = (
  draft: RoutineDraft,
  initial: RoutineDraft,
  routine: Routine | null,
  now = Date.now(),
): string => {
  try {
    const rescheduled = !routine || scheduleFields.some((key) => draft[key] !== initial[key]);
    let next = rescheduled ? nextRunPreview(draft) : routine.nextRunAt;
    if (next === undefined)
      return 'The next run is calculated from the cron expression when you save.';
    const end = draft.endLocal ? Date.parse(instantTime(draft.endLocal, draft.timezone)) : Infinity;
    const limit = Number(draft.maxRuns);
    if (next && Date.parse(next) > end) next = null;
    if (routine && limit && routine.runCount >= limit)
      return 'The run limit is reached, so it will not run again.';
    if (!next)
      return routine
        ? 'No further runs are scheduled.'
        : 'This schedule has no run before its end.';
    const when = `${formatInZone(next, draft.timezone)} (${draft.timezone})`;
    const due = Date.parse(next) <= now;
    const prefix = draft.enabled
      ? due
        ? `Due now (${when}); it runs shortly after you save`
        : `Next run ${when}`
      : `Paused; it would next run ${when}`;
    return `${prefix}.`;
  } catch (error) {
    return error instanceof Error ? error.message : 'Choose a valid date, time and timezone.';
  }
};

/** The row's next-run line: a paused routine never promises a time it will not run. */
export const nextRunLine = (
  routine: Pick<Routine, 'enabled' | 'nextRunAt' | 'timezone'>,
): string =>
  !routine.nextRunAt
    ? 'No run scheduled'
    : !routine.enabled
      ? 'Paused — no run scheduled'
      : `Next ${formatInZone(routine.nextRunAt, routine.timezone)} · ${routine.timezone}`;
