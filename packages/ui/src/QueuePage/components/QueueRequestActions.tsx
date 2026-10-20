import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button/index.tsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu/index.tsx';
import type { useQueueRequest } from '../hooks/useQueueRequest.ts';

export const QueueRequestActions = ({ model }: { model: ReturnType<typeof useQueueRequest> }) => {
  const { pending, editing, failed, working, editable, command, skip, setEditing, actionsRef } =
    model;
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
        <DropdownMenuGroup>
          {editable ? (
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil size={14} />
              Edit message
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onClick={() => command('remove')}>
            <Trash2 size={14} />
            Remove request
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
