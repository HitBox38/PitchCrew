import type { Card, Snapshot } from '@pitchcrew/core';
import { nextUp } from '../jobs.ts';

/** One line saying who moves the job next, beside its stage track. */
export const NextUp = ({ card, data }: { card: Card; data: Snapshot }) => {
  const next = nextUp(card, data);
  if (!next) return null;
  return (
    <p className="clay-job-now" data-tone={next.tone}>
      {next.tone === 'working' ? (
        <span className="clay-job-spinner" aria-hidden="true" />
      ) : next.tone === 'asks' ? (
        <span className="clay-bead" data-size="sm" data-tone="ochre" aria-hidden="true" />
      ) : null}
      <span>{next.text}</span>
    </p>
  );
};
