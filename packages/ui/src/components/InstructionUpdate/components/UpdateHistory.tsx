import type { InstructionUpdateModel } from '../types.ts';
import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { instructionUpdateExplanation } from '@/lib/instruction-updates.ts';

/** Release history behind "What's changed": every default revision since yours, and tool notes. */
export const UpdateHistory = ({ update, tools }: InstructionUpdateModel) => {
  return (
    <AccordionSection
      className="instruction-update-history"
      triggerClassName="instruction-update-history-trigger"
      heading={
        <>
          What’s changed{' '}
          <span className="ui-count">
            {update.changes.length} {update.changes.length === 1 ? 'release' : 'releases'}
          </span>
        </>
      }
    >
      <p className="instruction-update-explanation">{instructionUpdateExplanation(update)}</p>
      <ul className="instruction-update-changes" aria-label="What changed in the default">
        {update.changes.map((change) => (
          <li key={change.revision}>
            <time dateTime={change.date}>{change.date}</time> {change.summary}
          </li>
        ))}
      </ul>
      {tools.length ? (
        <p className="optional">
          Tools differ from this default for {tools.join('; ')}. This update changes instructions
          only.
        </p>
      ) : null}
    </AccordionSection>
  );
};
