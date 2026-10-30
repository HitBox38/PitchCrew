import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { timelineRuns } from '../helpers.ts';
import { useNow } from '../hooks/useNow.ts';

const time = (value: number) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Today's runs for one agent as clay bars in a groove; shown only in the clay preview. */
export const RunTimeline = ({ roleId }: { roleId: string }) => {
  const clay = useDevicePreferences((state) => state.clayInterface);
  const runs = useWorkspaceStore((state) => state.data?.runs);
  const now = useNow();
  if (!clay || !runs) return null;
  const placed = timelineRuns(
    runs.filter((run) => run.roleId === roleId && !run.reviewSeatReservation),
    now,
  );
  const count = placed.runs.length;
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
        <span>{time(placed.start)}</span>
        <span>{count ? `${count} ${count === 1 ? 'run' : 'runs'} today` : 'No runs today'}</span>
      </div>
    </div>
  );
};
