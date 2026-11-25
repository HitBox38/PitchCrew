import type { ReactNode } from 'react';
import { clockLabel } from '@/lib/time.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { timelineRuns } from '../helpers.ts';
import { useNow } from '../hooks/useNow.ts';

/**
 * Today's runs for one agent as clay bars in a groove, in the agent's identity dye, from a start
 * written in the shared clock ("8:00 AM", as the runs listed under it). The count can be rendered
 * by the caller, e.g. as the trigger for a keyboard-reachable list of the same runs.
 */
export const RunTimeline = ({
  roleId,
  count: renderCount,
}: {
  roleId: string;
  count?: (label: string, count: number) => ReactNode;
}) => {
  const runs = useWorkspaceStore((state) => state.data?.runs);
  const now = useNow();
  if (!runs) return null;
  const placed = timelineRuns(
    runs.filter((run) => run.roleId === roleId && !run.reviewSeatReservation),
    now,
  );
  const count = placed.runs.length;
  const label = count ? `${count} ${count === 1 ? 'run' : 'runs'} today` : 'No runs today';
  return (
    <div className="clay-run-timeline">
      <div className="clay-groove" aria-hidden="true">
        {placed.runs.map((run) => (
          <span
            key={run.id}
            className="clay-groove-run"
            data-live={run.live ? '' : undefined}
            style={{ left: `${Math.min(run.left, 98)}%`, width: `${run.width}%` }}
          />
        ))}
        <span className="clay-groove-now" />
      </div>
      <div className="clay-run-timeline-labels">
        <span>{clockLabel(placed.start)}</span>
        {renderCount ? renderCount(label, count) : <span>{label}</span>}
      </div>
    </div>
  );
};
