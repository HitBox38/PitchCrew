import { QueueRequestItems } from './QueueRequestItems.tsx';
import { Ellipsis } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@pitchcrew/design-system/dropdown-menu';
import type { useQueueRequest } from '../hooks/useQueueRequest.ts';

/** The request's trailing 44px menu; failed requests keep it only when they can still move. */
export const QueueRequestActions = ({ model }: { model: ReturnType<typeof useQueueRequest> }) => {
  const { pending, editing, failed, working, actionsRef, moves } = model;
  const movable = Boolean(moves.up || moves.down || moves.makeNext);
  if (!pending || editing || (failed && !movable)) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={actionsRef}
        render={<Button variant="ghost" size="icon" className="queue-menu-trigger" />}
        aria-label="Queued request actions"
        disabled={working}
      >
        <Ellipsis size={16} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Queued request actions">
        <QueueRequestItems model={model} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
