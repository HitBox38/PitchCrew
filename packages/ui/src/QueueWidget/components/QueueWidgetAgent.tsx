import { Link } from '@tanstack/react-router';
import type { Run, Snapshot, WorkQueueView } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { runActivityLabel } from '@/lib/work-queue.ts';

/** A running agent inside a queue; links to that exact run in its conversation. */
export const QueueWidgetAgent = ({
  run,
  queue,
  data,
  close,
}: {
  run: Run;
  queue: WorkQueueView;
  data: Snapshot;
  close: () => void;
}) => {
  const name = data.roles.find((role) => role.id === run.roleId)?.name ?? run.roleId;
  const activity = runActivityLabel(run);
  return (
    <Link
      to="/chat/$thread"
      params={{ thread: run.threadId ?? queue.threadId }}
      search={{ run: run.id }}
      onClick={close}
      className="queue-widget-agent"
      aria-label={`View ${name} activity for ${queue.title}`}
      aria-description={activity}
    >
      <RoleAvatar agentRole={run.roleId} size="small" />
      <span className="queue-widget-agent-name" title={name}>
        {name}
      </span>
      <span className="queue-widget-agent-activity" title={activity}>
        {activity}
      </span>
    </Link>
  );
};
