import { ChevronDown } from 'lucide-react';
import type { Card } from '@pitchcrew/core';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { StaleCleanup } from './StaleCleanup.tsx';
import { TagMerge } from './TagMerge.tsx';

/** Closed by default; nothing here runs without a reviewed confirmation. */
export const InsightsTidyUp = ({ cards, tags }: { cards: Card[]; tags: string[] }) => {
  return (
    <Collapsible className="ui-section insights-tidy">
      <h2 className="insights-tidy-heading">
        <CollapsibleTrigger className="insights-tidy-trigger">
          <span>Tidy up</span>
          <span className="insights-note">Merge tags · Mark silent applications</span>
          <ChevronDown size={16} aria-hidden="true" />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent keepMounted>
        <div className="ui-tray insights-tidy-content">
          <TagMerge cards={cards} tags={tags} />
          <StaleCleanup />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
