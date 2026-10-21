import type { ReactElement } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu/index.tsx';
import type { useQueueRequest } from '../hooks/useQueueRequest.ts';
import { QueueRequestItems } from './QueueRequestItems.tsx';

export const QueueRequestContextMenu = ({
  model,
  children,
}: {
  model: ReturnType<typeof useQueueRequest>;
  children: ReactElement;
}) => {
  if (model.editing) return children;
  return (
    <ContextMenu disabled={!model.pending}>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent
        aria-label="Queued request actions"
        finalFocus={() => model.actionsRef.current ?? false}
      >
        {model.failed ? (
          <>
            <ContextMenuItem disabled={model.working} onClick={() => model.command('resume')}>
              Retry
            </ContextMenuItem>
            <ContextMenuItem disabled={model.working} onClick={() => void model.skip()}>
              Skip and continue
            </ContextMenuItem>
          </>
        ) : (
          <QueueRequestItems model={model} context />
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
