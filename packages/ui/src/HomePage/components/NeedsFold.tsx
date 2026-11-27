import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import { foldSummary } from '../helpers.ts';
import type { DeskEntry } from '../types.ts';
import { DeskRow, type EntryProps } from './DeskRow.tsx';

type NeedsFoldProps = Omit<EntryProps, 'entry'> & {
  folded: DeskEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * A long tier's later entries behind one disclosure that says how many still wait, of which kinds
 * and how old the oldest is; once all are decided it says how many were. The desk opens it before
 * opening a row inside. The trigger stays put when it opens, and its rows stay mounted closed.
 */
export const NeedsFold = ({ folded, open, onOpenChange, ...props }: NeedsFoldProps) => {
  const { label, waiting } = foldSummary(folded, props.now);
  return (
    <Collapsible className="needs-fold" open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="needs-folded" data-decided={waiting ? undefined : ''}>
        <Bead tone="ochre" size="sm" className="needs-bead" />
        <span className="needs-folded-label">{label}</span>
        <ChevronDown size={16} className="needs-folded-chevron" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted className="needs-fold-panel">
        {folded.map((entry) => (
          <DeskRow key={entry.key} entry={entry} {...props} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
