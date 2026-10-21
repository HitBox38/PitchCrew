import { QueueRunningItems } from './QueueRunningItems.tsx';
import type { WorkQueueView } from '@pitchcrew/core';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button/index.tsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu/index.tsx';
import type { useQueueActions } from '@/hooks/useQueueActions.ts';

export const QueueRunningMenu = ({
  queue,
  model,
}: {
  queue: WorkQueueView;
  model: ReturnType<typeof useQueueActions>;
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon-sm" />}
        aria-label={`Queue actions for ${queue.title}`}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Queue actions">
        <QueueRunningItems queue={queue} model={model} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
