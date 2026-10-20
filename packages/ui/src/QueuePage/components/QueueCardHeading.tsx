import type { ReactNode } from 'react';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/index.tsx';
import { useQueueActions } from '@/hooks/useQueueActions.ts';
import { queueStateLabels } from '@/lib/work-queue.ts';
import { QueueIdentity } from './QueueIdentity.tsx';

export const QueueCardHeading = ({
  queue,
  handle,
  answerThreadId,
  data,
}: {
  queue: WorkQueueView;
  handle?: ReactNode;
  answerThreadId?: string;
  data: Snapshot;
}) => {
  const { open, command, working, resumeBlocked } = useQueueActions(queue, answerThreadId);
  return (
    <div className="queue-card-heading">
      {handle}
      <div className="min-w-0 flex-1">
        <QueueIdentity queue={queue} data={data} />
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
