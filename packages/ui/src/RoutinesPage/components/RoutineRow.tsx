import type { Routine, Snapshot } from '@pitchcrew/core';
import { Badge } from '@/components/ui/badge/index.tsx';
import { RoutineActions } from './RoutineActions.tsx';
import { RoutineSchedule } from './RoutineSchedule.tsx';

export const RoutineRow = ({
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
}) => {
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
  const card = data.cards.find((card) => card.id === routine.cardId);
  return (
    <li className="routine-row">
      <div className="flex min-w-0 flex-col gap-2">
        <h2>{routine.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="quiet font-semibold">{role?.name}</span>
          <Badge variant="secondary" className="routine-status" data-status={status}>
            {status}
          </Badge>
        </div>
        <p className="line-clamp-3 max-w-prose wrap-anywhere whitespace-pre-wrap text-ink-soft">
          {routine.content}
        </p>
        {card ? (
          <p className="quiet">
            {card.company} — {card.title}
          </p>
        ) : null}
        {routine.error || (lastRun && lastRun.status === 'failed') ? (
          <p className="form-error">{routine.error || lastRun?.message}</p>
        ) : null}
      </div>
      <RoutineSchedule routine={routine} lastStatus={lastRun?.status} />
      <RoutineActions {...{ routine, working, edit, toggle, remove }} />
    </li>
  );
};
