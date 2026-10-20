import type { AgentTask } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const QueueFollowUps = ({ tasks, queueId }: { tasks: AgentTask[]; queueId: string }) => {
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const recover = (taskId: string, kind: string) =>
    void action(`/queue/${encodeURIComponent(queueId)}`, 'PUT', { action: kind, taskId }).catch(
      () => {},
    );
  return tasks.length ? (
    <ul className="queue-follow-ups">
      {tasks.map((task) => (
        <li key={task.id}>
          <p>
            {task.roleId}: {task.content.slice(0, 180)}{' '}
            <span className="quiet">({task.status})</span>
          </p>
          {task.status === 'failed' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="form-error">{task.error}</span>
              <Button disabled={working} onClick={() => recover(task.id, 'retry-follow-up')}>
                Retry follow-up
              </Button>
              <Button disabled={working} onClick={() => recover(task.id, 'skip-follow-up')}>
                Skip and continue
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  ) : null;
};
