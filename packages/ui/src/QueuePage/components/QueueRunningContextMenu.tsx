import { useRef, type ReactElement } from 'react';
import type { WorkQueueView } from '@pitchcrew/core';
import type { useQueueActions } from '@/hooks/useQueueActions.ts';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu/index.tsx';
import { QueueRunningItems } from './QueueRunningItems.tsx';

export const QueueRunningContextMenu = ({
  queue,
  model,
  children,
}: {
  queue: WorkQueueView;
  model: ReturnType<typeof useQueueActions>;
  children: ReactElement;
}) => {
  const trigger = useRef<HTMLDivElement | null>(null);
  return (
    <ContextMenu>
      <ContextMenuTrigger ref={trigger} render={children} />
      <ContextMenuContent
        aria-label="Queue actions"
        finalFocus={() =>
          trigger.current?.querySelector<HTMLButtonElement>(
            'button[aria-label^="Queue actions for"]',
          ) ?? true
        }
      >
        <QueueRunningItems queue={queue} model={model} context />
      </ContextMenuContent>
    </ContextMenu>
  );
};
