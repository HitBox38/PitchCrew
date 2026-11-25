import { Link } from '@tanstack/react-router';
import { Button } from '@pitchcrew/design-system/button';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import type { BulkOutcome } from '../types.ts';

/**
 * One job's outcome: its bead (a dash when nothing was sent), the company and what happened, with
 * Open entry on a job whose fit was already queued, so the user finds the existing request instead
 * of a duplicate. Its name starts with its visible words ("Open entry for Corvid in Queue").
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
    {outcome.kind === 'existing' ? (
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Shared Button renders the actual router anchor below.
        role="link"
        render={<Link to="/queue" />}
        aria-label={`Open entry for ${outcome.company} in Queue`}
      >
        Open entry
      </Button>
    ) : null}
  </li>
);
