import type { Routine, RoutineInput } from '@pitchcrew/core';
import type { Frequency, RoutineDraft } from './types.ts';

export function localTime(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
export function instantTime(local: string, timezone: string): string {
  const normalized = /T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local;
  const wall = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(wall)) throw new Error('Choose a valid date and time.');
  let result = wall;
  for (let i = 0; i < 4; i++) {
    const shown = Date.parse(`${localTime(new Date(result).toISOString(), timezone)}Z`);
    result += wall - shown;
  }
  if (localTime(new Date(result).toISOString(), timezone) !== normalized)
    throw new Error(
      'This time does not exist during the daylight-saving change. Choose another time.',
    );
  return new Date(result).toISOString();
}
export function initialDraft(routine: Routine | null): RoutineDraft {
  const timezone = routine?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const startLocal = localTime(
    routine?.startAt ?? new Date(Date.now() + 3600000).toISOString(),
    timezone,
  );
  const patterns = calendarPatterns(startLocal, routine?.cron ?? '0 9 * * 1-5');
  const calendarFrequency = (['daily', 'weekdays', 'weekly', 'monthly'] as const).find(
    (frequency) => patterns[frequency] === routine?.cron,
  );
  return {
    name: routine?.name ?? '',
    roleId: routine?.roleId ?? 'scout',
    content: routine?.content ?? '',
    cardId: routine?.cardId ?? '',
    startLocal,
    timezone,
    frequency: routine?.cron
      ? (calendarFrequency ?? 'custom')
      : routine?.intervalMinutes
        ? 'interval'
        : 'once',
    interval: String(routine?.intervalMinutes ?? 1),
    unit: 'minutes',
    cron: routine?.cron ?? '0 9 * * 1-5',
    maxRuns: routine?.maxRuns ? String(routine.maxRuns) : '',
    endLocal: routine?.endsAt ? localTime(routine.endsAt, timezone) : '',
    enabled: routine?.enabled ?? true,
  };
}
export function draftInput(draft: RoutineDraft): RoutineInput {
  const patterns = calendarPatterns(draft.startLocal, draft.cron);
  return {
    name: draft.name,
    roleId: draft.roleId,
    content: draft.content,
    cardId: draft.cardId || null,
    startAt: instantTime(draft.startLocal, draft.timezone),
    timezone: draft.timezone,
    cron: patterns[draft.frequency],
    intervalMinutes:
      draft.frequency === 'interval'
        ? Number(draft.interval) * { minutes: 1, hours: 60, days: 1440, weeks: 10080 }[draft.unit]
        : null,
    maxRuns: draft.maxRuns ? Number(draft.maxRuns) : null,
    endsAt: draft.endLocal ? instantTime(draft.endLocal, draft.timezone) : null,
    enabled: draft.enabled,
  };
}
function calendarPatterns(startLocal: string, custom: string): Record<Frequency, string | null> {
  const [date, time] = startLocal.split('T');
  if (!date || !time) throw new Error('Choose a start date and time.');
  const [hour, minute] = time.split(':').map(Number);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const day = Number(date.split('-')[2]);
  return {
    daily: `${minute} ${hour} * * *`,
    weekdays: `${minute} ${hour} * * 1-5`,
    weekly: `${minute} ${hour} * * ${weekday}`,
    monthly: `${minute} ${hour} ${day} * *`,
    custom,
    once: null,
    interval: null,
  };
}
export function scheduleLabel(routine: Pick<Routine, 'cron' | 'intervalMinutes'>): string {
  if (routine.intervalMinutes) {
    const units = [
      [10080, 'week'],
      [1440, 'day'],
      [60, 'hour'],
      [1, 'minute'],
    ] as const;
    const [divisor, unit] = units.find(([minutes]) => routine.intervalMinutes! % minutes === 0)!;
    const count = routine.intervalMinutes / divisor;
    return `Every ${count} ${unit}${count === 1 ? '' : 's'}`;
  }
  if (!routine.cron) return 'One-time action';
  const [minute, hour, day, month, weekday] = routine.cron.split(/\s+/);
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && month === '*') {
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    if (day === '*') {
      if (weekday === '*') return `Daily at ${time}`;
      if (weekday === '1-5') return `Weekdays at ${time}`;
      if (/^[0-6]$/.test(weekday))
        return `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(weekday)]} at ${time}`;
    }
    if (/^\d+$/.test(day) && weekday === '*') return `Monthly on day ${day} at ${time}`;
  }
  return `Custom schedule: ${routine.cron}`;
}
export function routineInput(routine: Routine): RoutineInput {
  const {
    name,
    roleId,
    content,
    cardId,
    startAt,
    timezone,
    cron,
    intervalMinutes,
    maxRuns,
    endsAt,
    enabled,
  } = routine;
  return {
    name,
    roleId,
    content,
    cardId,
    startAt,
    timezone,
    cron,
    intervalMinutes,
    maxRuns,
    endsAt,
    enabled,
  };
}
