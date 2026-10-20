import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import type { TrackingSignal } from '@pitchcrew/core';

export const TrackingSource = ({ signal }: { signal: TrackingSignal }) => {
  return (
    <>
      <blockquote className="my-2 border-l-2 border-border pl-3 whitespace-pre-wrap">
        {signal.quote}
      </blockquote>
      <AccordionSection
        className="my-2"
        heading={<>Read fetched email{signal.sourceTruncated ? ' (incomplete source)' : ''}</>}
      >
        <p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap">{signal.sourceText}</p>
      </AccordionSection>
    </>
  );
};
