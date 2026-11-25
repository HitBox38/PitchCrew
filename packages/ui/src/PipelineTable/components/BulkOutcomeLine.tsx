import { Link } from '@tanstack/react-router';
import { Button } from '@pitchcrew/design-system/button';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import type { BulkOutcome } from '../types.ts';

/** The Queue control for a job whose existing or possible request the user should look at. */
const queueControl = {
  existing: {
    label: 'Open entry',
    name: (company: string) => `Open entry for ${company} in Queue`,
  },
  unconfirmed: { label: 'Check queue', name: (company: string) => `Check queue for ${company}` },
} as const;

/**
 * One job's outcome: its bead (a dash when nothing was sent), the company and what happened. A job
 * whose fit was already queued has Open entry, so the user finds the existing request instead of a
 * duplicate; one whose call got no answer has Check queue, where its line asks them to look. Each
 * name starts with its visible words ("Open entry for Corvid in Queue").
 */
export const BulkOutcomeLine = ({ outcome }: { outcome: BulkOutcome }) => (
  <li data-kind={outcome.kind}>
    {outcome.bead ? (
      <Bead tone={outcome.bead === 'socket' ? undefined : outcome.bead} />
    ) : (
      <span className="bulk-result-dash" aria-hidden="true" />
    )}
    <span className="bulk-result-company">{outcome.company}</span>
    <span className="bulk-result-text">{outcome.text}</span>
    {outcome.kind === 'existing' || outcome.kind === 'unconfirmed' ? (
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Shared Button renders the actual router anchor below.
        role="link"
        render={<Link to="/queue" />}
        aria-label={queueControl[outcome.kind].name(outcome.company)}
      >
        {queueControl[outcome.kind].label}
      </Button>
    ) : null}
  </li>
);
