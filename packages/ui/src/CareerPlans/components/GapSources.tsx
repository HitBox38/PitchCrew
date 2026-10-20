import type { CareerGap } from '@pitchcrew/core';
import { AccordionSection } from '@/components/ui/accordion/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const GapSources = ({ sources }: { sources: CareerGap['sources'] }) => {
  const cards = useWorkspaceStore((s) => s.data?.cards);
  const open = useWorkspaceStore((s) => s.openCard);
  const jobs = new Set(sources.map((s) => s.cardId)).size;
  return (
    <AccordionSection heading={`Requirements from ${jobs} ${jobs === 1 ? 'job' : 'jobs'}`}>
      <ul className="space-y-2">
        {sources.map((source, i) => {
          const card = cards?.find((c) => c.id === source.cardId);
          return (
            <li key={i}>
              <Button variant="link" onClick={() => open(source.cardId)}>
                {card ? `${card.company}: ${card.title}` : 'Source job'}
              </Button>
              <p>{source.requirement}</p>
            </li>
          );
        })}
      </ul>
    </AccordionSection>
  );
};
