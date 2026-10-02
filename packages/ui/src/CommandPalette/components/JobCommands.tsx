import type { JobCommandsProps } from '@/CommandPalette/types.ts';
import { CompanyMark } from '@/components/CompanyMark/index.tsx';
import { CommandGroup } from '@/components/ui/command/components/CommandGroup.tsx';
import { CommandItem } from '@/components/ui/command/components/CommandItem.tsx';
import { CommandShortcut } from '@/components/ui/command/components/CommandShortcut.tsx';
import { stateLabels } from '@/lib/labels.ts';

export function JobCommands({ cards, run, onOpenCard }: JobCommandsProps) {
  return (
    <CommandGroup heading="Jobs">
      {cards.map((card) => (
        <CommandItem
          key={card.id}
          value={`${card.title} ${card.company} ${card.location} ${card.tags.join(' ')} ${card.id}`}
          onSelect={run(() => onOpenCard(card.id))}
        >
          <CompanyMark name={card.company} />
          <span className="command-job">
            {card.title} <small>{card.company}</small>
          </span>
          <CommandShortcut>{stateLabels[card.state]}</CommandShortcut>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
