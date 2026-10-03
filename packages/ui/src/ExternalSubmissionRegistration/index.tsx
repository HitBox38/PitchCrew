import { ExternalSubmissionFields } from '@/ExternalSubmissionFields/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { Card } from '@pitchcrew/core';
import { useExternalSubmission } from './hooks/useExternalSubmission.ts';

export function ExternalSubmissionRegistration({ card }: { card: Card }) {
  const { registerSubmission, working, error } = useExternalSubmission(card.id);
  if (
    ![
      'lead',
      'shortlisted',
      'drafting',
      'in_review',
      'changes_requested',
      'agreed',
      'awaiting_approval',
    ].includes(card.state)
  )
    return null;
  return (
    <details className="my-4">
      <summary>Already applied outside Pitchcrew?</summary>
      <p className="quiet my-2">
        Record a known submission on this application. The existing packet stays in history; this
        does not identify it as the packet you submitted.
      </p>
      <form
        className="form flex flex-col gap-3"
        onSubmit={(event) => void registerSubmission(event)}
      >
        <ExternalSubmissionFields jobIdentifier={card.tracking?.jobIdentifier} />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={working || !!card.owner}>
          Register external submission
        </Button>
      </form>
    </details>
  );
}
