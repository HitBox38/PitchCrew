import { Link } from '@tanstack/react-router';
import type { Run, Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import { runActivityLabel } from '@/lib/work-queue.ts';

export const QueueRun = ({ run, data }: { run: Run; data: Snapshot }) => {
  const role = data.roles.find((item) => item.id === run.roleId);
  return (
    <li className="queue-agent-run">
      <RoleAvatar agentRole={run.roleId} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <strong>{role?.name ?? run.roleId}</strong>
          <span className="queue-agent-status" aria-hidden="true" />
          <span className="sr-only">Working</span>
          <span className="sr-only">{runtimeLabels[run.runtime]}</span>
        </div>
        <p className="line-clamp-2" title={runActivityLabel(run)}>
          {runActivityLabel(run)}
        </p>
      </div>
      {run.threadId ? (
        <Link
          to="/chat/$thread"
          params={{ thread: run.threadId }}
          search={{ run: run.id }}
          className="queue-run-link"
          aria-label={`View ${role?.name ?? run.roleId} activity`}
        >
          View
        </Link>
      ) : null}
    </li>
  );
};
