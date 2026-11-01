import type { Routine, Run } from '@pitchcrew/core';
import { Link } from '@tanstack/react-router';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { timeAgo } from '@/lib/time.ts';
import { routineStatus } from '../schedule-preview.ts';
import type { Role } from '@pitchcrew/core';

const runWords: Partial<Record<Run['status'], string>> = {
  completed: 'completed',
  failed: 'failed',
  cancelled: 'stopped',
  waiting: 'is waiting for you',
  running: 'is running',
};

/** Where the routine stands, plus its last run linked to the exact conversation turn. */
export const RoutineOutcome = ({
  routine,
  role,
  lastRun,
}: {
  routine: Routine;
  role?: Role;
  lastRun?: Run;
}) => {
  const status = routineStatus(routine, role, lastRun);
  const when = routine.lastScheduledAt ? timeAgo(routine.lastScheduledAt) : '';
  const last = lastRun ? `Last run ${runWords[lastRun.status] ?? lastRun.status}` : '';
  return (
    <div className="routine-outcome">
      <span className="routine-status">
        <span
          className="clay-bead"
          data-size="sm"
          data-tone={status.tone}
          data-empty={status.tone ? undefined : ''}
          data-live={status.tone === 'plum' ? '' : undefined}
          aria-hidden="true"
        />
        {status.label}
      </span>
      {lastRun?.threadId ? (
        <Link
          className="routine-last-run"
          to="/chat/$thread"
          params={{ thread: lastRun.threadId }}
          search={{ run: lastRun.id }}
        >
          <StatusBead status={lastRun.status} />
          {last} {when}
        </Link>
      ) : when ? (
        <span className="routine-last-run">Last run {when}</span>
      ) : null}
    </div>
  );
};
