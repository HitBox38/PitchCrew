import { QueueRequestItems } from './QueueRequestItems.tsx';
import { Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button/index.tsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu/index.tsx';
import type { useQueueRequest } from '../hooks/useQueueRequest.ts';

export const QueueRequestActions = ({ model }: { model: ReturnType<typeof useQueueRequest> }) => {
  const { pending, editing, failed, working, command, skip, actionsRef } = model;
  if (!pending || editing) return null;
  if (failed)
    return (
      <div className="queue-row-actions">
        <Button variant="outline" size="sm" disabled={working} onClick={() => command('resume')}>
          Retry
        </Button>
        <Button variant="outline" size="sm" disabled={working} onClick={() => void skip()}>
          Skip and continue
        </Button>
      </div>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={actionsRef}
        render={<Button variant="outline" size="icon-sm" />}
        aria-label="Queued request actions"
        disabled={working}
      >
        <Ellipsis size={15} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Queued request actions">
        <QueueRequestItems model={model} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
