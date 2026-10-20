import { Link } from '@tanstack/react-router';
import { boardActionLabels } from '@pitchcrew/core/states';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/index.tsx';
import { useQueueActions } from '@/hooks/useQueueActions.ts';
import {
  executingRuns,
  queueAnswerThread,
  queueIdentity,
  queueStateLabels,
  runActivityLabel,
} from '@/lib/work-queue.ts';

export const QueueWidgetWork = ({
  queue,
  data,
  close,
}: {
  queue: WorkQueueView;
  data: Snapshot;
  close: () => void;
}) => {
  const runs = executingRuns(queue.runs);
  const identity = queueIdentity(queue, data);
  const { open } = useQueueActions(
    queue,
    queue.state === 'waiting' ? queueAnswerThread(queue, data) : undefined,
  );
  const request = queue.requests[0];
  return (
    <li className="queue-widget-work">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <Button
          variant="ghost"
          className="queue-widget-open"
          aria-label={`Open ${queue.title}`}
          onClick={() => {
            close();
            open();
          }}
        >
          <span className="min-w-0">
            <strong className="block truncate" title={identity.title}>
              {identity.title}
            </strong>
            <span className="queue-widget-subtitle">{identity.subtitle}</span>
          </span>
        </Button>
        {!['running', 'ready'].includes(queue.state) ? (
          <span className={`queue-state queue-state-${queue.state}`}>
            {queueStateLabels[queue.state]}
          </span>
        ) : null}
      </div>
      {runs.map((run) => {
        const name = data.roles.find((role) => role.id === run.roleId)?.name ?? run.roleId;
        return (
          <Link
            key={run.id}
            to="/chat/$thread"
            params={{ thread: run.threadId ?? queue.threadId }}
            search={{ run: run.id }}
            onClick={close}
            className="queue-widget-agent"
            aria-label={`View ${name} activity for ${queue.title}`}
            aria-description={runActivityLabel(run)}
          >
            <RoleAvatar agentRole={run.roleId} size="small" />
            <span className="max-w-28 shrink-0 truncate" title={name}>
              {name}
            </span>
            <span className="truncate text-muted-foreground" title={runActivityLabel(run)}>
              {runActivityLabel(run)}
            </span>
          </Link>
        );
      })}
      {!runs.length && queue.state === 'running' ? (
        <p className="quiet">Preparing the next step…</p>
      ) : null}
      {queue.state === 'ready' && request ? (
        <p className="queue-widget-preview line-clamp-2">
          {request.boardAction ? boardActionLabels[request.boardAction] : request.content}
        </p>
      ) : null}
      {queue.state !== 'running' && queue.reason ? <p className="quiet">{queue.reason}</p> : null}
    </li>
  );
};
