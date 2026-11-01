import type { Card } from '@pitchcrew/core';
import { ChevronDown } from 'lucide-react';
import { dropStages } from '@/board-stages.ts';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';

/** Stage links: each opens its column with the search cleared. Counts cover the whole group. */
export const JumpToMenu = ({ cards, jump }: { cards: Card[]; jump: (stage: string) => void }) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="board-jump" />}>
      Jump to <ChevronDown size={14} aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-52" finalFocus={false}>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Jump to a stage</DropdownMenuLabel>
        {dropStages.map((stage) => (
          <DropdownMenuItem key={stage.id} onClick={() => jump(stage.id)}>
            <span className="flex-1">{stage.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {cards.filter((card) => stage.states.includes(card.state)).length}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);
