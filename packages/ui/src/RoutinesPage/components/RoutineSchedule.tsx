import type { Routine } from '@pitchcrew/core';
import { CalendarClock } from 'lucide-react';
import { scheduleLabel } from '../helpers.ts';

export function RoutineSchedule({
  routine,
  lastStatus,
}: {
  routine: Routine;
  lastStatus?: string;
}) {
  const format = (instant: string) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: routine.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(instant));
  return (
    <div className="routine-schedule flex min-w-0 flex-col gap-1.5">
      <p className="flex items-start gap-2 font-semibold">
        <CalendarClock size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
        {scheduleLabel(routine)}
      </p>
      {routine.nextRunAt ? (
        <p>
          <span className="text-muted-foreground">Next run </span>
          <time dateTime={routine.nextRunAt}>{format(routine.nextRunAt)}</time>
        </p>
      ) : null}
      <p className="quiet">{routine.timezone}</p>
      <p className="quiet">
        {routine.runCount}
        {routine.maxRuns ? ` / ${routine.maxRuns}` : ''} runs dispatched
      </p>
      {routine.endsAt ? <p className="quiet">Ends {format(routine.endsAt)}</p> : null}
      {routine.lastScheduledAt ? (
        <p className="quiet">
          Last: {format(routine.lastScheduledAt)}
          {lastStatus ? ` (${lastStatus})` : ''}
        </p>
      ) : null}
    </div>
  );
}
