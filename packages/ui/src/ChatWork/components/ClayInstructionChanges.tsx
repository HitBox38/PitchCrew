import { useMemo } from 'react';
import { InstructionComparison } from '@/ChatWork/components/InstructionComparison.tsx';
import type { InstructionComparisonProps } from '@/ChatWork/types.ts';
import { InstructionDiff } from '@/components/InstructionUpdate/components/InstructionDiff.tsx';
import { diffInstructions } from '@/components/InstructionUpdate/helpers.ts';
import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';

/** Only the changed paragraphs in a recessed tray; both full texts stay one disclosure away. */
export const ClayInstructionChanges = ({ current, proposal }: InstructionComparisonProps) => {
  const after = proposal.changes.instructions ?? '';
  const lines = useMemo(
    () => diffInstructions(current.instructions, after),
    [current.instructions, after],
  );
  const changed = lines.filter((line) => line.kind !== 'same');
  const same = lines.length - changed.length;
  return (
    <>
      <div className="clay-proposal-tray">
        {changed.length ? (
          <InstructionDiff lines={changed} />
        ) : (
          <p className="clay-proposal-quiet">The instructions stay as they are.</p>
        )}
        {same && changed.length ? (
          <p className="clay-proposal-quiet">
            {same} unchanged {same === 1 ? 'paragraph is' : 'paragraphs are'} not shown.
          </p>
        ) : null}
      </div>
      <AccordionSection heading="Compare full instructions">
        <InstructionComparison current={current} proposal={proposal} />
      </AccordionSection>
    </>
  );
};
