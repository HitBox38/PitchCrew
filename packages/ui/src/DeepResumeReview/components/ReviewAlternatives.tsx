import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import type { Dispatch, SetStateAction } from 'react';
import type { ReviewAlternativeRow, ReviewSupport } from '../types.ts';
import { ReviewAlternative } from './ReviewAlternative.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
export function ReviewAlternatives({
  runtimes,
  alternatives,
  setAlternatives,
  error,
}: {
  runtimes: ReviewSupport[];
  alternatives: ReviewAlternativeRow[];
  setAlternatives: Dispatch<SetStateAction<ReviewAlternativeRow[]>>;
  error: string;
}) {
  const supported = runtimes.find(
    (runtime) => runtime.available && runtime.applicationIsolation && runtime.reviewSubagents,
  );
  return (
    <AccordionSection
      triggerClassName="cursor-pointer"
      heading="Optional subagent runtime alternatives"
    >
      <div className="mt-3 grid gap-3">
        <p className="optional">
          Subagents inherit Reviewer’s runtime and model. Add alternatives to allow Reviewer to
          choose another setup for this review.
        </p>
        {alternatives.map((value, index) => (
          <ReviewAlternative
            key={value.id}
            value={value}
            index={index}
            runtimes={runtimes}
            change={(next) =>
              setAlternatives((items) =>
                items.map((item, i) => (i === index ? { ...next, id: item.id } : item)),
              )
            }
            remove={() => setAlternatives((items) => items.filter((_, i) => i !== index))}
          />
        ))}
        <Button
          disabled={!supported || alternatives.length >= 12}
          onClick={() => {
            if (supported)
              setAlternatives((items) => [
                ...items,
                { id: crypto.randomUUID(), runtime: supported.id, model: '', reasoning: null },
              ]);
          }}
        >
          Add runtime alternative
        </Button>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </AccordionSection>
  );
}
