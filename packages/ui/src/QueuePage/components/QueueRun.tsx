import { Link } from '@tanstack/react-router';
import type { Run, Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import { runActivityLabel } from '@/lib/work-queue.ts';

/** One executing agent: pebble, name, its latest public step and a link to that exact run. */
export const QueueRun = ({ run, data }: { run: Run; data: Snapshot }) => {
  const role = data.roles.find((item) => item.id === run.roleId);
  const name = role?.name ?? run.roleId;
  return (
    <li className="queue-agent-run">
      <RoleAvatar agentRole={run.roleId} size="small" />
      <strong>{name}</strong>
      <span className="sr-only">Working</span>
      <span className="sr-only">{runtimeLabels[run.runtime]}</span>
      <span className="queue-agent-step" title={runActivityLabel(run)}>
        {runActivityLabel(run)}
      </span>
      {run.threadId ? (
        <Link
          to="/chat/$thread"
          params={{ thread: run.threadId }}
          search={{ run: run.id }}
          className="queue-run-link"
          aria-label={`View ${name} activity`}
        >
          View
        </Link>
      ) : null}
    </li>
  );
};
