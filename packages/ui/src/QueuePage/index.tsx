import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { WorkspaceHeaderActions } from '@/App/components/WorkspacePage.tsx';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { QueueCapacity } from './components/QueueCapacity.tsx';
import { QueueCard } from './components/QueueCard.tsx';
import { QueueList } from './components/QueueList.tsx';
import { AddQueueAction } from './components/AddQueueAction.tsx';

export const QueuePage = () => {
  const data = useWorkspaceStore((s) => s.data);
  const action = useWorkspaceStore((s) => s.action);
  const queue = data?.queue;
  if (!data || !queue) return null;
  const running = queue.queues.filter((q) => q.state === 'running');
  const waiting = queue.queues.filter((q) => q.state !== 'running');
  return (
    <section className="queue-workspace" aria-label="Workspace queue">
      <WorkspaceHeaderActions>
        <AddQueueAction data={data} />
      </WorkspaceHeaderActions>
      <QueueCapacity queue={queue} />
      <div className="queue-work-area">
        {running.length ? (
          <section aria-label="Running work">
            <h2>
              Running <span>{running.length}</span>
            </h2>
            <div className="grid gap-3">
              {running.map((q) => (
                <QueueCard key={q.id} queue={q} data={data} />
              ))}
            </div>
          </section>
        ) : null}
        {waiting.length ? (
          <section aria-label="Waiting work">
            <h2>
              Up next <span>{waiting.length}</span>
            </h2>
            <p className="quiet mb-3">
              Drag a job to change its priority. Expand it to arrange its actions.
            </p>
            <QueueList
              items={waiting}
              group="Workspace waiting order"
              commit={(id, beforeId) =>
                action(`/queue/${encodeURIComponent(id)}`, 'PUT', { action: 'move', beforeId })
              }
              render={(q, handle) => <QueueCard queue={q} data={data} handle={handle} />}
            />
          </section>
        ) : null}
        {!queue.queues.length ? (
          <EmptyState
            title="Your crew is ready"
            description="Queue actions from the board, or add a sequence here. Jobs work independently while actions within each job stay in order."
          >
            <AddQueueAction data={data} />
          </EmptyState>
        ) : null}
      </div>
    </section>
  );
};
