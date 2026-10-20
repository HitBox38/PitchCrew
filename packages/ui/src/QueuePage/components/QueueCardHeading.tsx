import type { ReactNode } from 'react';
import type { WorkQueueView } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/index.tsx';
import { useQueueActions } from '../hooks/useQueueActions.ts';
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
  const { open, command, working, resumeBlocked } = useQueueActions(queue, answerThreadId);
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
        <Button variant="outline" size="sm" onClick={open}>
          {queue.state === 'waiting' ? 'Answer' : 'Open'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={working || resumeBlocked}
          onClick={() => command(queue.paused ? 'resume' : 'pause')}
        >
          {queue.paused ? 'Resume' : 'Pause'}
        </Button>
      </div>
    </div>
  );
};
