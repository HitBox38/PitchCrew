import { useEffect } from 'react';
import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { ExternalSubmissionFields } from '@/ExternalSubmissionFields/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { Card } from '@pitchcrew/core';
import { useExternalSubmission } from './hooks/useExternalSubmission.ts';

export const ExternalSubmissionRegistration = ({
  card,
  onDirtyChange,
}: {
  card: Card;
  onDirtyChange?: (dirty: boolean) => void;
}) => {
  const { registerSubmission, working, error, dirty, setDirty, revision } = useExternalSubmission(
    card.id,
  );
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
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
    <AccordionSection heading="Already applied outside Pitchcrew?">
      <p className="quiet my-2">
        Record a known submission on this application. The existing packet stays in history; this
        does not identify it as the packet you submitted.
      </p>
      <form
        key={revision}
        className="form flex flex-col gap-3"
        onChangeCapture={() => setDirty(true)}
        onSubmit={(event) => void registerSubmission(event)}
      >
        <ExternalSubmissionFields
          jobIdentifier={card.tracking?.jobIdentifier}
          onChange={() => setDirty(true)}
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          className="button primary self-start"
          type="submit"
          disabled={working || !!card.owner}
        >
          Register external submission
        </Button>
      </form>
    </AccordionSection>
  );
};
