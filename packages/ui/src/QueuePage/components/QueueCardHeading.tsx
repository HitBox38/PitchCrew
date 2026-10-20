import type { ReactNode } from 'react';
import type { WorkQueueView } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';

export function QueueCardHeading({ queue, handle }: { queue: WorkQueueView; handle?: ReactNode }) {
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
        <h3>{queue.title}</h3>
        <span className={`queue-state queue-state-${queue.state}`}>
          {
            {
              ready: 'Waiting for a slot',
              running: 'Working',
              waiting: 'Waiting for your answer',
              paused: 'Paused',
              blocked: 'Needs attention',
            }[queue.state]
          }
        </span>
      </div>
      <div className="queue-row-actions">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            queue.cardId ? openCard(queue.cardId) : void navigation.openChat(queue.threadId)
          }
        >
          Open
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
}
