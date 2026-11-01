import { TriangleAlert } from 'lucide-react';
import type { Card, SubmissionAttempt } from '@pitchcrew/core';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { ExternalConfirmation } from '@/components/CardDetails/components/ExternalConfirmation.tsx';
import type { JobOverviewProps } from '@/components/CardDetails/types.ts';
import type { SubmissionFollowUpProps } from '../hooks/useSubmissionFollowUp.ts';
import { ClaySubmissionFollowUp } from './ClaySubmissionFollowUp.tsx';

/** An uncertain browser submission, with the existing resolve actions only. */
export const ClaySubmissionCheck = ({
  card,
  attempt,
  act,
  working,
  later,
  followUp,
}: Pick<JobOverviewProps, 'act' | 'working'> & {
  card: Card;
  attempt: SubmissionAttempt;
  later: () => void;
  followUp: SubmissionFollowUpProps;
}) => {
  const resolve = (confirmed: boolean) =>
    act(
      `/submissions/${attempt.id}/resolve`,
      confirmed
        ? { confirmed, reason: 'User verified captured website submission confirmation' }
        : { confirmed, reason: 'User verified no submission occurred; browser actions may resume' },
      confirmed ? 'Submission verified' : 'Outcome resolved; submission may be attempted again',
    );
  return (
    <section className="clay-submission-check" aria-label="Submission outcome">
      <span className="clay-browser-chip" data-tone="rose">
        <TriangleAlert size={13} aria-hidden="true" />
        Needs checking
      </span>
      <h3>Did the {card.company} application go through?</h3>
      <p>
        The submit step ran, but nothing confirmed it. Submitting again stays blocked so you don’t
        apply twice. Check the page or your email, then record what you see.
      </p>
      {attempt.evidence ? <blockquote>{attempt.evidence}</blockquote> : null}
      {attempt.confirmation ? (
        <AccordionSection heading="Captured confirmation page">
          <p>{attempt.confirmation.url}</p>
          <SourceBlock
            label="Confirmation text"
            value={attempt.confirmation.text}
            contentClassName="font-sans"
          />
        </AccordionSection>
      ) : null}
      <div className="clay-submission-actions">
        {attempt.confirmation ? (
          <Button size="sm" disabled={working} onClick={() => resolve(true)}>
            I see the confirmation
          </Button>
        ) : null}
        <Button size="sm" variant="outline" disabled={working} onClick={() => resolve(false)}>
          It didn’t go through
        </Button>
        <Button size="sm" variant="ghost" onClick={later}>
          Verify later
        </Button>
      </div>
      <ClaySubmissionFollowUp {...followUp} card={card} attempt={attempt} />
      <ExternalConfirmation id={attempt.id} act={act} working={working} />
    </section>
  );
};
