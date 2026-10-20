import type { ReactNode } from 'react';
import type { WorkQueueView } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { queueStateLabels } from '@/lib/work-queue.ts';
import { MessageSquare, BriefcaseBusiness } from 'lucide-react';

export const QueueCardHeading = ({
  queue,
  handle,
  answerThreadId,
}: {
  queue: WorkQueueView;
  handle?: ReactNode;
  answerThreadId?: string;
}) => {
  const action = useWorkspaceStore((s) => s.action);
  const openCard = useWorkspaceStore((s) => s.openCard);
  const working = useWorkspaceStore((s) => s.working);
  const navigation = useWorkspaceNavigation();
  const command = (kind: string) =>
    void action(`/queue/${encodeURIComponent(queue.id)}`, 'PUT', { action: kind }).catch(() => {});
  return (
    <div className="queue-card-heading">
      {handle}
      <div className="min-w-0 flex-1">
        <span className="queue-kind">
          {queue.cardId ? <BriefcaseBusiness size={12} /> : <MessageSquare size={12} />}
          {queue.cardId ? 'Job' : 'Conversation'}
        </span>
        <h3>{queue.title}</h3>
        <span className={`queue-state queue-state-${queue.state}`}>
          {queueStateLabels[queue.state]}
        </span>
      </div>
      <div className="queue-row-actions">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            queue.cardId && queue.state !== 'waiting'
              ? openCard(queue.cardId)
              : void navigation.openChat(answerThreadId ?? queue.threadId)
          }
        >
          {queue.state === 'waiting' ? 'Answer' : 'Open'}
        </Button>
        {queue.state === 'running' ? (
          <Button variant="outline" size="sm" disabled={working} onClick={() => command('stop')}>
            Stop
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={
            working || (queue.paused && queue.pauseKind !== undefined && queue.pauseKind !== 'user')
          }
          onClick={() => command(queue.paused ? 'resume' : 'pause')}
        >
          {queue.paused ? 'Resume' : 'Pause'}
        </Button>
      </div>
    </div>
  );
};
