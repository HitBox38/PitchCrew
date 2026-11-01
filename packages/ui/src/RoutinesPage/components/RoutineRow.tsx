import type { Routine, Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Switch } from '@/components/ui/switch/index.tsx';
import { scheduleLabel } from '../helpers.ts';
import { nextRunLine, routineJob, runLimitLabel } from '../schedule-preview.ts';
import { RoutineMenu } from './RoutineMenu.tsx';
import { RoutineOutcome } from './RoutineOutcome.tsx';

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
  const role = data.roles.find((item) => item.id === routine.roleId);
  const lastRun = data.runs.find((run) => run.id === routine.lastRunId);
  const failure = routine.error || (lastRun?.status === 'failed' ? lastRun.message : '');
  const job = routineJob(routine, data.cards);
  return (
    <li className="routine-row" data-enabled={routine.enabled}>
      <RoleAvatar agentRole={routine.roleId} size="small" />
      <div className="routine-identity">
        <button type="button" data-routine-focus={routine.id} onClick={edit}>
          {routine.name}
        </button>
        <p title={routine.content}>
          {role?.name ?? routine.roleId} · {routine.content}
        </p>
      </div>
      <div className="routine-when">
        <p>
          {scheduleLabel(routine)}
          {routine.maxRuns || routine.runCount ? ` · ${runLimitLabel(routine)}` : ''}
        </p>
        <p>
          {routine.enabled && routine.nextRunAt ? (
            <time dateTime={routine.nextRunAt}>{nextRunLine(routine)}</time>
          ) : (
            nextRunLine(routine)
          )}
        </p>
      </div>
      <p className="routine-job" data-empty={job ? undefined : ''}>
        {job || 'No job'}
      </p>
      <RoutineOutcome routine={routine} role={role} lastRun={lastRun} />
      <div className="routine-controls">
        <Switch
          checked={routine.enabled}
          disabled={working || !routine.nextRunAt}
          onCheckedChange={toggle}
          aria-label={`Run ${routine.name} on schedule`}
        />
        <RoutineMenu routine={routine} working={working} edit={edit} remove={remove} />
      </div>
      {failure ? <p className="routine-error">{failure}</p> : null}
    </li>
  );
};
