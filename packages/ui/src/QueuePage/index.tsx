import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { WorkspaceHeaderActions } from '@/App/components/WorkspacePage.tsx';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { QueueCapacity } from './components/QueueCapacity.tsx';
import { QueueCard } from './components/QueueCard.tsx';
import { AddQueueAction } from './components/AddQueueAction.tsx';
import { QueuePending } from './components/QueuePending.tsx';
import { QueueSectionHeading } from './components/QueueSectionHeading.tsx';
import { queueSummary } from '@/lib/work-queue.ts';
import { Layers3 } from 'lucide-react';

export const QueuePage = () => {
  const data = useWorkspaceStore((s) => s.data);
  const queue = data?.queue;
  if (!data || !queue) return null;
  const { running, ready, held, agents } = queueSummary(queue);
  return (
    <section className="queue-workspace" aria-label="Workspace queue">
      <WorkspaceHeaderActions>
        <AddQueueAction data={data} />
      </WorkspaceHeaderActions>
      <div className="queue-work-area">
        <QueueCapacity queue={queue} />
        <section aria-label="Running work" className="queue-running-section">
          <QueueSectionHeading title="Working now" count={running.length}>
            {agents.length
              ? `${agents.length} agent ${agents.length === 1 ? 'run' : 'runs'} working across independent jobs and conversations.`
              : 'Jobs and conversations can work side by side, even with the same agent.'}
          </QueueSectionHeading>
          {running.length ? (
            <div className="queue-running-grid">
              {running.map((q) => (
                <QueueCard key={q.id} queue={q} data={data} />
              ))}
            </div>
          ) : queue.queues.length || queue.background ? (
            <div className="queue-running-empty">
              <Layers3 size={22} aria-hidden="true" />
              <p>
                {queue.background
                  ? 'Background routines are working. No jobs or conversations are running.'
                  : 'No jobs or conversations are running. Ready work starts automatically when it can.'}
              </p>
            </div>
          ) : null}
        </section>
        {queue.queues.length ? (
          <QueuePending ready={ready} held={held} data={data} />
        ) : !queue.background ? (
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
