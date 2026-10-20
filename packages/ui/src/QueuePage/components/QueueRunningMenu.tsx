import type { WorkQueueView } from '@pitchcrew/core';
import { MoreHorizontal, Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button/index.tsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu/index.tsx';
import { useQueueActions } from '../hooks/useQueueActions.ts';

export const QueueRunningMenu = ({ queue }: { queue: WorkQueueView }) => {
  const { command, working, resumeBlocked } = useQueueActions(queue);
  const PauseIcon = queue.paused ? Play : Pause;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon-sm" />}
        aria-label={`Queue actions for ${queue.title}`}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Queue actions">
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={working || resumeBlocked}
            onClick={() => command(queue.paused ? 'resume' : 'pause')}
          >
            <PauseIcon size={14} />
            {queue.paused ? 'Resume queue' : 'Pause queue'}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={working} onClick={() => command('stop')}>
            <Square size={14} />
            Stop current work
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
