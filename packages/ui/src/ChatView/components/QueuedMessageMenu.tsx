import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@pitchcrew/design-system/dropdown-menu';
import { Ellipsis } from 'lucide-react';
export const QueuedMessageMenu = ({
  update,
  working,
}: {
  update: (command: string) => Promise<unknown>;
  working: boolean;
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Queued message options"
            disabled={working}
          />
        }
      >
        <Ellipsis size={13} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void update('up')}>Move earlier</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void update('down')}>Move later</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void update('interrupt')}>
            Interrupt current work and send
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
