import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { citationRows, noteCitations } from '../helpers.ts';
import type { ProfileViewModel } from '../types.ts';
import { ProfileCitation } from './ProfileCitation.tsx';

/** Packets whose registered claims quote this exact note, as compact rows in one recessed tray. */
export const ProfileCitations = ({
  data,
  activeSavedName,
}: Pick<ProfileViewModel, 'data' | 'activeSavedName'>) => {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 80rem)').matches);
  const cited = activeSavedName ? citationRows(noteCitations(data.cards, activeSavedName)) : [];
  if (!cited.length) return null;
  const heading = `Cited in ${cited.length} ${cited.length === 1 ? 'packet' : 'packets'}`;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="profile-citations">
      <CollapsibleTrigger className="profile-citations-heading">
        <ChevronRight size={14} aria-hidden="true" />
        {heading}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="profile-citation-list">
          {cited.map((card) => (
            <ProfileCitation key={card.id} card={card} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};
