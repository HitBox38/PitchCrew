import type { Routine, Snapshot } from '@pitchcrew/core';
import { Badge } from '@/components/ui/badge/index.tsx';
import { scheduleLabel } from '../helpers.ts';
import { RoutineActions } from './RoutineActions.tsx';

export function RoutineRow({
  routine,
  data,
  working,
  edit,
  toggle,
  remove,
}: {
  routine: Routine;
  data: Snapshot;
  working: boolean;
  edit(): void;
  toggle(): void;
  remove(): void;
}) {
  const role = data.roles.find((role) => role.id === routine.roleId);
  const lastRun = data.runs.find((run) => run.id === routine.lastRunId);
  const running = lastRun?.status === 'running';
  const status = running
    ? 'Running'
    : !routine.nextRunAt
      ? 'Finished'
      : !routine.enabled
        ? 'Paused'
        : !role?.enabled
          ? 'Agent paused'
          : 'Scheduled';
  const format = (instant: string) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: routine.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(instant));
  const card = data.cards.find((card) => card.id === routine.cardId);
  return (
    <li className="grid gap-5 border-b border-border py-6 last:border-0 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl">{routine.name}</h2>
          <Badge variant="secondary">{status}</Badge>
          <span className="quiet">{role?.name}</span>
        </div>
        <p className="line-clamp-3 max-w-prose wrap-anywhere whitespace-pre-wrap text-ink-soft">
          {routine.content}
        </p>
        {card ? (
          <p className="quiet">
            {card.company} — {card.title}
          </p>
        ) : null}
        <RoutineActions {...{ routine, working, edit, toggle, remove }} />
        {routine.error || (lastRun && lastRun.status === 'failed') ? (
          <p className="form-error">{routine.error || lastRun?.message}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        <p className="font-semibold">{scheduleLabel(routine)}</p>
        {routine.nextRunAt ? (
          <p>
            Next: <time dateTime={routine.nextRunAt}>{format(routine.nextRunAt)}</time>
          </p>
        ) : null}
        <p className="quiet">{routine.timezone}</p>
        <p>
          {routine.runCount}
          {routine.maxRuns ? ` / ${routine.maxRuns}` : ''} runs dispatched
        </p>
        {routine.endsAt ? <p className="quiet">Ends {format(routine.endsAt)}</p> : null}
        {routine.lastScheduledAt ? (
          <p className="quiet">
            Last: {format(routine.lastScheduledAt)}
            {lastRun ? ` (${lastRun.status})` : ''}
          </p>
        ) : null}
      </div>
    </li>
  );
}
