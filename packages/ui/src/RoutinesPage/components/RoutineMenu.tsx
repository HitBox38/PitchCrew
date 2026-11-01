import type { Routine } from '@pitchcrew/core';
import { useNavigate } from '@tanstack/react-router';
import { History, MessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';

export const RoutineMenu = ({
  routine,
  working,
  edit,
  remove,
}: {
  routine: Routine;
  working: boolean;
  edit(): void;
  remove(): void;
}) => {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label={`Actions for ${routine.name}`}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={working} onClick={edit}>
            <Pencil size={14} /> Edit routine
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              void navigate({
                to: '/chat/$thread',
                params: { thread: routine.conversationId || routine.roleId },
              })
            }
          >
            <MessageSquare size={14} /> Open chat
          </DropdownMenuItem>
          {routine.lastRunId ? (
            <DropdownMenuItem
              onClick={() =>
                void navigate({ to: '/activity', search: { q: routine.name, kind: 'routine' } })
              }
            >
              <History size={14} /> History
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" disabled={working} onClick={remove}>
            <Trash2 size={14} /> Delete routine
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
