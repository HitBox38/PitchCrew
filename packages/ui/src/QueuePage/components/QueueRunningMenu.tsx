import { QueueRunningItems } from './QueueRunningItems.tsx';
import type { WorkQueueView } from '@pitchcrew/core';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@pitchcrew/design-system/dropdown-menu';
import type { useQueueActions } from '@/hooks/useQueueActions.ts';

export const QueueRunningMenu = ({
  queue,
  model,
  label,
}: {
  queue: WorkQueueView;
  model: ReturnType<typeof useQueueActions>;
  /** The trigger's accessible name where the queue title alone would be unclear. */
  label?: string;
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="queue-menu-trigger" />}
        aria-label={label ?? `Queue actions for ${queue.title}`}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Queue actions">
        <QueueRunningItems queue={queue} model={model} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
