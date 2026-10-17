import type { Card, CardState } from '@pitchcrew/core';
import { dropStages } from '@/board-stages.ts';
import { stateLabels } from '@/lib/labels.ts';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';
import { ArrowRightLeft, Check } from 'lucide-react';

export function MoveToMenu({
  card,
  disabled,
  move,
}: {
  card: Card;
  disabled: boolean;
  move: (state: CardState) => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        <ArrowRightLeft size={15} />
        Move to…
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="max-h-[min(65vh,480px,var(--available-height))] min-w-48"
        aria-label="Job status"
      >
        {dropStages.map((stage) => (
          <DropdownMenuGroup key={stage.id}>
            <DropdownMenuLabel>{stage.label}</DropdownMenuLabel>
            {stage.states.map((state) => (
              <DropdownMenuItem
                key={state}
                disabled={disabled || state === card.state}
                onClick={() => move(state)}
              >
                <span className="w-4">{state === card.state ? <Check size={15} /> : null}</span>
                {stateLabels[state]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
