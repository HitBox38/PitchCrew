import type { ReactNode } from 'react';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { useQueueActions } from '@/hooks/useQueueActions.ts';
import { QueueIdentity } from './QueueIdentity.tsx';
import { QueueOrderMenu } from './QueueOrderMenu.tsx';
import type { QueueMoves } from '../types.ts';

export const QueueCardHeading = ({
  queue,
  handle,
  moves,
  answerThreadId,
  data,
}: {
  queue: WorkQueueView;
  handle?: ReactNode;
  moves: QueueMoves;
  answerThreadId?: string;
  data: Snapshot;
}) => {
  const { open, command, working, resumeBlocked } = useQueueActions(queue, answerThreadId);
  return (
    <div className="queue-card-heading">
      {handle}
      <QueueIdentity queue={queue} data={data} />
      <div className="queue-row-actions">
        <Button
          variant="ghost"
          size="sm"
          disabled={working || resumeBlocked}
          onClick={() => command(queue.paused ? 'resume' : 'pause')}
        >
          {queue.paused ? 'Resume' : 'Pause'}
        </Button>
        <Button variant="outline" size="sm" onClick={open}>
          {queue.state === 'waiting' ? 'Answer' : 'Open'}
        </Button>
        <QueueOrderMenu title={queue.title} moves={moves} />
      </div>
    </div>
  );
};
