import { Link } from '@tanstack/react-router';
import { RunTimeline } from '@/ClayInterface/components/RunTimeline.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { todaysRuns } from '@/CrewPage/helpers.ts';
import { clockLabel } from '@/lib/time.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

const states = {
  running: 'Working',
  waiting: 'Waiting',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Stopped',
};

/** The day's groove, with its count opening a list of the same runs for keyboard and touch. */
export const CrewTimeline = ({
  roleId,
  name,
  now,
}: {
  roleId: string;
  name: string;
  now: number;
}) => {
  const data = useWorkspaceStore((state) => state.data);
  return (
    <Collapsible className="crew-timeline">
      <RunTimeline
        roleId={roleId}
        count={(label, count) =>
          count ? (
            <CollapsibleTrigger className="crew-timeline-trigger" aria-label={`${name}: ${label}`}>
              {label}
            </CollapsibleTrigger>
          ) : (
            <span>{label}</span>
          )
        }
      />
      <CollapsibleContent>
        <ul className="crew-timeline-runs" aria-label={`${name}’s runs today`}>
          {data
            ? todaysRuns(roleId, data, now).map(({ run, subject }) => (
                <li key={run.id}>
                  <time dateTime={run.startedAt}>{clockLabel(run.startedAt)}</time>
                  {run.threadId ? (
                    <Link
                      to="/chat/$thread"
                      params={{ thread: run.threadId }}
                      search={{ run: run.id }}
                    >
                      {subject}
                    </Link>
                  ) : (
                    <span>{subject}</span>
                  )}
                  <span className="crew-timeline-state" data-status={run.status}>
                    {states[run.status]}
                  </span>
                </li>
              ))
            : null}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};
