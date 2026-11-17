import { keyedItems } from '@/lib/list-keys.ts';
import type { ReviewAssessment } from '@pitchcrew/core';
import { reviewPerspectives } from '@pitchcrew/core/deep-review-labels';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@pitchcrew/design-system/accordion';
import { PerspectiveNotes } from './PerspectiveNotes.tsx';

/**
 * The seven perspectives once, each with its verdict before and after corrections, instead of two
 * full lists. Opening a row shows the reasoning from both passes.
 */
export const PerspectiveComparison = ({
  before,
  after,
}: {
  before: ReviewAssessment;
  after?: ReviewAssessment | null;
}) => {
  const latest = after ?? before;
  const notes = [
    ...(latest.packetFeedback ?? []).map((note) => `Packet blocker: ${note}`),
    ...(latest.suggestions ?? []).map((note) => `Suggestion: ${note}`),
  ];
  return (
    <section className="deep-review-perspectives" aria-label="Seven perspectives">
      <h4>
        Seven perspectives{' '}
        {after ? <span className="detail-aside">before → after corrections</span> : null}
      </h4>
      <p>{latest.summary}</p>
      {notes.length ? (
        <ul className="feedback">
          {keyedItems(notes, (note) => note).map(({ item: note, key }) => (
            <li key={key}>{note}</li>
          ))}
        </ul>
      ) : null}
      <Accordion multiple>
        {before.perspectives.map((item) => {
          const later = after?.perspectives.find((other) => other.perspective === item.perspective);
          return (
            <AccordionItem key={item.perspective} value={item.perspective}>
              <AccordionTrigger>
                <span className="deep-review-verdict">
                  <span>{reviewPerspectives[item.perspective]}</span>
                  <strong>
                    {item.verdict}
                    {later ? ` → ${later.verdict}` : ''}
                  </strong>
                </span>
              </AccordionTrigger>
              <AccordionContent keepMounted>
                <PerspectiveNotes item={item} />
                {later ? (
                  <>
                    <h5>After corrections</h5>
                    <PerspectiveNotes item={later} />
                  </>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
};
