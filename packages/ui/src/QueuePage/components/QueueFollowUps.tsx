import type { AgentTask, Snapshot } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/index.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { taskLabels } from '@/lib/task-status.ts';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';

export const QueueFollowUps = ({
  tasks,
  queueId,
  data,
}: {
  tasks: AgentTask[];
  queueId: string;
  data: Snapshot;
}) => {
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const recover = (taskId: string, kind: 'retry-follow-up' | 'skip-follow-up') =>
    void action(`/queue/${encodeURIComponent(queueId)}`, 'PUT', { action: kind, taskId }).catch(
      () => {},
    );
  return tasks.length ? (
    <ul className="queue-follow-ups" aria-label="Crew follow-ups">
      {tasks.map((task) => (
        <li key={task.id}>
          <div className="queue-follow-up-heading">
            <RoleAvatar agentRole={task.roleId} size="small" />
            <strong>
              {data.roles.find((role) => role.id === task.roleId)?.name ?? task.roleId}
            </strong>
            <span>
              <StatusBead status={task.status} />
              {taskLabels[task.status]}
            </span>
          </div>
          <p className="queue-follow-up-text" title={task.content}>
            {task.content}
          </p>
          {task.status === 'failed' ? (
            <div className="queue-row-actions">
              <p className="queue-request-error">{task.error}</p>
              <Button
                variant="outline"
                size="sm"
                disabled={working}
                onClick={() => recover(task.id, 'retry-follow-up')}
              >
                Retry follow-up
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={working}
                onClick={() => recover(task.id, 'skip-follow-up')}
              >
                Skip and continue
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  ) : null;
};
