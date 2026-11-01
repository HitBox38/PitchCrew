import { ArrowDown, ArrowUp, ArrowUpToLine, Ellipsis } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@pitchcrew/design-system/dropdown-menu';
import type { QueueMoves } from '../types.ts';

/** Touch and pointer equivalents of dragging a waiting queue: Move to top, up or down. */
export const QueueOrderMenu = ({ title, moves }: { title: string; moves: QueueMoves }) => {
  const items = [
    ['Move to top', ArrowUpToLine, moves.makeNext],
    ['Move up', ArrowUp, moves.up],
    ['Move down', ArrowDown, moves.down],
  ] as const;
  if (!items.some(([, , run]) => run)) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="queue-menu-trigger" />}
        aria-label={`Order of ${title}`}
      >
        <Ellipsis size={16} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Queue order">
        <DropdownMenuGroup>
          {items.map(([label, Icon, run]) =>
            run ? (
              <DropdownMenuItem key={label} onClick={run}>
                <Icon size={14} />
                {label}
              </DropdownMenuItem>
            ) : null,
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
