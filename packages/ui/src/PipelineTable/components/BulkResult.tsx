import { Fragment } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { useScrollEdges } from '@/hooks/useScrollEdges.ts';
import { isSettled, outcomeParts } from '../bulk.ts';
import { useResultFocus } from '../hooks/useResultFocus.ts';
import type { BulkReport } from '../types.ts';
import { BulkOutcomeLine } from './BulkOutcomeLine.tsx';

/** "16 jobs · 10 queued · …" that wraps only after a separator, never inside a count. */
const SummaryParts = ({ parts }: { parts: readonly string[] }) =>
  parts.map((part, index) => (
    <Fragment key={part}>
      {index ? ' ' : null}
      <span className="bulk-result-part">{index < parts.length - 1 ? `${part} ·` : part}</span>
    </Fragment>
  ));

/**
 * A batch's result, above the table it reports on: the counts, once that each job is checked again
 * when it starts (the server rechecks the brief against the job source then, which the snapshot
 * cannot), and one line per job in table order, in a list whose edges shade while more lines are
 * above or below. A workspace reason says nothing was sent. When the selection bar left with the
 * batch, focus lands on the summary so it is read.
 */
export const BulkResult = ({ report, dismiss }: { report: BulkReport; dismiss: () => void }) => {
  const summary = useResultFocus(report);
  const { ref: listRef, above, below } = useScrollEdges<HTMLUListElement>();
  const outcomes = 'blocker' in report ? [] : report.outcomes;
  const sent = outcomes.some(isSettled);
  return (
    <section className="bulk-result" aria-label="Evaluate fit results">
      <div className="bulk-result-head">
        <output ref={summary} tabIndex={-1} className="bulk-result-summary">
          {'blocker' in report ? (
            `Nothing was sent: ${report.blocker}`
          ) : (
            <SummaryParts parts={outcomeParts(outcomes)} />
          )}
        </output>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
      </div>
      {sent ? <p className="bulk-result-note">Each job is checked again when it starts.</p> : null}
      {outcomes.length ? (
        <ul
          ref={listRef}
          className="bulk-result-list"
          data-more-above={above ? '' : undefined}
          data-more-below={below ? '' : undefined}
        >
          {outcomes.map((outcome) => (
            <BulkOutcomeLine key={outcome.cardId} outcome={outcome} />
          ))}
        </ul>
      ) : null}
    </section>
  );
};
