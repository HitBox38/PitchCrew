import type { JobCommandsProps } from '@/CommandPalette/types.ts';
import { CompanyMark } from '@/components/CompanyMark/index.tsx';
import { CommandGroup } from '@/components/ui/command/components/CommandGroup.tsx';
import { stateLabels } from '@/lib/labels.ts';
import { useJobCommands } from '../hooks/useJobCommands.ts';
import { JobCommandPages } from './JobCommandPages.tsx';
import { PaletteItem } from './PaletteItem.tsx';

export const JobCommands = ({ cards, run, onOpenCard, recentIds }: JobCommandsProps) => {
  const page = useJobCommands(cards, recentIds);
  if (!page.total) return null;
  return (
    <CommandGroup
      heading={`Jobs${page.pages > 1 ? ` · ${page.start + 1}–${page.end} of ${page.total}` : ''}`}
    >
      <output className="sr-only">
        {page.total} matching jobs. Showing {page.start + 1} through {page.end}.
      </output>
      {page.entries.map(({ card, value }) => (
        <PaletteItem
          key={card.id}
          value={value}
          mark={<CompanyMark name={card.company} />}
          label={card.title}
          context={`${card.company} · ${stateLabels[card.state]}`}
          onSelect={run(() => onOpenCard(card.id))}
        />
      ))}
      <JobCommandPages {...page} />
    </CommandGroup>
  );
};
