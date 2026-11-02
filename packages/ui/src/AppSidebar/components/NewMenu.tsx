import { Briefcase, FilePlus2, MessageSquarePlus, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import { Button } from '@pitchcrew/design-system/button';
import { useSidebar } from '@pitchcrew/design-system/sidebar';
import { useNewActions } from '../hooks/useNewActions.ts';
import { StripButton } from './StripButton.tsx';

/** The strip's + menu: a job, a conversation or a Profile note, using the existing actions. */
export const NewMenu = ({
  onAddJob,
  side,
}: {
  onAddJob: () => void;
  side?: 'bottom' | 'right';
}) => {
  const { state, isMobile } = useSidebar();
  const create = useNewActions(onAddJob);
  return (
    <DropdownMenu>
      <StripButton
        label="New"
        side={side}
        render={
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" className="sidebar-strip-button" />}
            aria-label="New"
          />
        }
      >
        <Plus aria-hidden="true" />
      </StripButton>
      <DropdownMenuContent
        className="sidebar-new-menu min-w-52"
        side={side ?? (state === 'collapsed' && !isMobile ? 'right' : 'bottom')}
        align="start"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={create.addJob}>
            <Briefcase aria-hidden="true" /> New job
            <DropdownMenuShortcut>N</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={create.newConversation}>
            <MessageSquarePlus aria-hidden="true" /> New conversation
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void create.newNote()}>
            <FilePlus2 aria-hidden="true" /> New note
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
