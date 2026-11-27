import type { WorkQueueView } from '@pitchcrew/core';
import { ArrowRight } from 'lucide-react';
import { useQueueActions } from '@/hooks/useQueueActions.ts';
import type { LensEntry } from '@/lib/crew-lens.ts';
import { QueueRunningMenu } from '@/QueuePage/components/QueueRunningMenu.tsx';

/** Pause, Resume and Stop for one job queue, named for its job: never for the agent. */
const LensQueueMenu = ({ queue, label }: { queue: WorkQueueView; label?: string }) => {
  const model = useQueueActions(queue);
  return <QueueRunningMenu queue={queue} model={model} label={label} />;
};

/**
 * An entry's trailing control. Running work in a queue carries that queue's own menu ("Job queue
 * actions for Acme Robotics"; a conversation queue keeps Queue's label); everything else shows a
 * pointer, since the whole entry is its link to Home's item, the run or Queue.
 */
export const LensControl = ({ entry }: { entry: LensEntry }) => {
  const { queue } = entry;
  if (queue)
    return (
      <LensQueueMenu
        queue={queue}
        label={queue.cardId ? `Job queue actions for ${entry.subject}` : undefined}
      />
    );
  return <ArrowRight size={16} className="crew-lens-pointer" aria-hidden="true" />;
};
