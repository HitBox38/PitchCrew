import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { WorkspaceHeaderFact, WorkspaceHeaderPrimary } from '@/App/components/WorkspacePage.tsx';
import { queueSummary } from '@/lib/work-queue.ts';
import { QueueCapacity } from './components/QueueCapacity.tsx';
import { AddQueueAction } from './components/AddQueueAction.tsx';
import { QueuePending } from './components/QueuePending.tsx';
import { QueueWorking } from './components/QueueWorking.tsx';

/** What is in the workspace slots, what starts next and what waits on you. */
export const QueuePage = () => {
  const data = useWorkspaceStore((s) => s.data);
  const queue = data?.queue;
  if (!data || !queue) return null;
  const { running, ready, held, agents } = queueSummary(queue);
  const empty = !queue.queues.length && !queue.background;
  return (
    <section className="queue-page" aria-label="Workspace queue">
      <WorkspaceHeaderFact>
        <QueueCapacity queue={queue} />
      </WorkspaceHeaderFact>
      <WorkspaceHeaderPrimary>
        <AddQueueAction data={data} />
      </WorkspaceHeaderPrimary>
      <div className="queue-work-area">
        {empty ? (
          <p className="ui-empty">No work queued. Add an action or start from a job.</p>
        ) : (
          <>
            <QueueWorking running={running} agents={agents.length} queue={queue} data={data} />
            <QueuePending ready={ready} held={held} data={data} />
          </>
        )}
      </div>
    </section>
  );
};
