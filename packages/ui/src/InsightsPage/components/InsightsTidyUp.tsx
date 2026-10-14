import { ChevronDown } from 'lucide-react';
import type { Card } from '@pitchcrew/core';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { StaleCleanup } from './StaleCleanup.tsx';
import { TagMerge } from './TagMerge.tsx';

export function InsightsTidyUp({ cards, tags }: { cards: Card[]; tags: string[] }) {
  return (
    <Collapsible className="insights-tidy">
      <h2>
        <CollapsibleTrigger className="insights-tidy-trigger">
          <span>
            <span className="insights-tidy-title">Tidy up</span>
            <span className="insights-tidy-description">
              Merge tags and review silent applications
            </span>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent keepMounted>
        <div className="insights-tidy-content flex flex-col gap-5">
          <TagMerge cards={cards} tags={tags} />
          <StaleCleanup />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
