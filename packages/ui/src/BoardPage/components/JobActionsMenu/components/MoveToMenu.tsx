import type { Card, CardState } from '@pitchcrew/core';
import { dropStages } from '@/board-stages.ts';
import { stateLabels } from '@/lib/labels.ts';
import { menuComponents } from '@/components/ui/context-menu/menu-components.ts';
import { ArrowRightLeft, Check } from 'lucide-react';

export const MoveToMenu = ({
  card,
  disabled,
  context = false,
  move,
  finalFocus,
}: {
  card: Card;
  disabled: boolean;
  context?: boolean;
  move: (state: CardState) => void;
  finalFocus: () => boolean;
}) => {
  const Menu = menuComponents(context);
  return (
    <Menu.Sub>
      <Menu.SubTrigger disabled={disabled}>
        <ArrowRightLeft size={15} />
        Move to…
      </Menu.SubTrigger>
      <Menu.SubContent
        className="max-h-[min(65vh,480px,var(--available-height))] min-w-48"
        aria-label="Job status"
        finalFocus={finalFocus}
      >
        {dropStages.map((stage) => (
          <Menu.Group key={stage.id}>
            <Menu.Label>{stage.label}</Menu.Label>
            {stage.states.map((state) => (
              <Menu.Item
                key={state}
                disabled={disabled || state === card.state}
                onClick={() => move(state)}
              >
                <span className="w-4">{state === card.state ? <Check size={15} /> : null}</span>
                {stateLabels[state]}
              </Menu.Item>
            ))}
          </Menu.Group>
        ))}
      </Menu.SubContent>
    </Menu.Sub>
  );
};
