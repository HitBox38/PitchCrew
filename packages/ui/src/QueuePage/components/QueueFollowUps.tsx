import type { AgentTask, Snapshot } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/index.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { taskLabels } from '@/lib/task-status.ts';

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
            <span>{taskLabels[task.status]}</span>
          </div>
          <p className="line-clamp-3" title={task.content}>
            {task.content}
          </p>
          {task.status === 'failed' ? (
            <div className="queue-row-actions mt-2">
              <p className="form-error w-full">{task.error}</p>
              <Button
                variant="outline"
                size="sm"
                disabled={working}
                onClick={() => recover(task.id, 'retry-follow-up')}
              >
                Retry follow-up
              </Button>
              <Button
                variant="outline"
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
