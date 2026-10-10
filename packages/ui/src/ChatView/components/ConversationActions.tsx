import type { ConversationHeadingProps } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu/index.tsx';
import { Ellipsis, Pin, Archive, Users, BookOpen, Settings, Play, Bell } from 'lucide-react';
export function ConversationActions({
  questions,
  conversation,
  patchConversation,
  setDialog,
  onConfigure,
  roleId,
  readOnly,
  action,
  thread,
  running,
  messages,
  working,
}: ConversationHeadingProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Conversation options" />}
      >
        <Ellipsis size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => void patchConversation({ notifyAll: !conversation?.notifyAll })}
          >
            <Bell size={14} />
            {conversation?.notifyAll
              ? 'Use outcome notifications'
              : 'Notify for every agent message'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void patchConversation({ pinned: !conversation?.pinned })}
          >
            <Pin size={14} />
            {conversation?.pinned ? 'Unpin' : 'Pin'} conversation
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void patchConversation({ archived: !conversation?.archived })}
          >
            <Archive size={14} />
            {conversation?.archived ? 'Restore' : 'Archive'} conversation
          </DropdownMenuItem>
          {!readOnly ? (
            <DropdownMenuItem onClick={() => setDialog('manage')}>
              <Users size={14} />
              Name, participants and job
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => setDialog('memory')}>
            <BookOpen size={14} />
            Agent memory
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onConfigure(roleId)}>
            <Settings size={14} />
            Agent defaults
          </DropdownMenuItem>
          {!readOnly && messages.length ? (
            <DropdownMenuItem
              disabled={working || !!running.length || !!questions.length}
              onClick={() => void action(`/conversations/${thread}/continue`).catch(() => {})}
            >
              <Play size={14} />
              Continue with summary
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
