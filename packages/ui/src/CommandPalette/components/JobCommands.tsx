import type { JobCommandsProps } from '@/CommandPalette/types.ts';
import { CompanyMark } from '@/components/CompanyMark/index.tsx';
import { CommandGroup } from '@/components/ui/command/components/CommandGroup.tsx';
import { CommandItem } from '@/components/ui/command/components/CommandItem.tsx';
import { CommandShortcut } from '@/components/ui/command/components/CommandShortcut.tsx';
import { useJobCommands } from '../hooks/useJobCommands.ts';
import { JobCommandPages } from './JobCommandPages.tsx';
import { stateLabels } from '@/lib/labels.ts';

export const JobCommands = ({ cards, run, onOpenCard }: JobCommandsProps) => {
  const page = useJobCommands(cards);
  if (!page.total) return null;
  return (
    <CommandGroup
      heading={`Jobs${page.pages > 1 ? ` · ${page.start + 1}–${page.end} of ${page.total}` : ''}`}
    >
      <output className="sr-only">
        {page.total} matching jobs. Showing {page.start + 1} through {page.end}.
      </output>
      {page.entries.map(({ card, value }) => (
        <CommandItem key={card.id} value={value} onSelect={run(() => onOpenCard(card.id))}>
          <CompanyMark name={card.company} />
          <span className="command-job">
            {card.title} <small>{card.company}</small>
          </span>
          <CommandShortcut>{stateLabels[card.state]}</CommandShortcut>
        </CommandItem>
      ))}
      <JobCommandPages {...page} />
    </CommandGroup>
  );
};
