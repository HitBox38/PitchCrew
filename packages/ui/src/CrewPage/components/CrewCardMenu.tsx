import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import type { CrewCardProps } from '@/CrewPage/types.ts';
import { useNavigate } from '@tanstack/react-router';
import { Ellipsis } from 'lucide-react';

/** Card actions beyond the visible name and Chat targets. */
export const CrewCardMenu = ({
  role,
  status,
  update,
  working,
  onConfigure,
  onChat,
  onToggle,
  onReview,
}: CrewCardProps) => {
  const navigate = useNavigate();
  const busy = status.kind === 'working';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="icon-button crew-card-menu"
            aria-label={`${role.name} options`}
          />
        }
      >
        <Ellipsis size={16} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onChat}>Chat</DropdownMenuItem>
          <DropdownMenuItem onClick={onConfigure}>Configure…</DropdownMenuItem>
          {update ? (
            <DropdownMenuItem onClick={onReview}>Compare instructions</DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={() => void navigate({ to: '/skills', search: { filter: role.id } })}
          >
            Skills
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={working || busy} onClick={onToggle}>
            {role.enabled ? 'Pause role' : 'Resume role'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
