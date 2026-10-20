import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { executingRuns, queueStateLabels, runActivityLabel } from '@/lib/work-queue.ts';

export const QueueWidgetWork = ({ queue, data }: { queue: WorkQueueView; data: Snapshot }) => {
  const runs = executingRuns(queue.runs);
  return (
    <li className="queue-widget-work">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <strong className="truncate" title={queue.title}>
          {queue.title}
        </strong>
        <span className={`queue-state queue-state-${queue.state}`}>
          {queueStateLabels[queue.state]}
        </span>
      </div>
      {runs.map((run) => (
        <div key={run.id} className="queue-widget-agent">
          <RoleAvatar agentRole={run.roleId} size="small" />
          <span
            className="max-w-28 shrink-0 truncate"
            title={data.roles.find((role) => role.id === run.roleId)?.name ?? run.roleId}
          >
            {data.roles.find((role) => role.id === run.roleId)?.name ?? run.roleId}
          </span>
          <span className="truncate text-muted-foreground" title={runActivityLabel(run)}>
            {runActivityLabel(run)}
          </span>
        </div>
      ))}
      {!runs.length && queue.state === 'running' ? (
        <p className="quiet">Preparing the next step…</p>
      ) : null}
      {queue.state !== 'running' && queue.reason ? <p className="quiet">{queue.reason}</p> : null}
    </li>
  );
};
