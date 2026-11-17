import { useReceiptDrafts } from '../hooks/useReceiptDrafts.ts';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { ExternalConfirmation } from './ExternalConfirmation.tsx';
import type { JobOverviewProps } from '../types.ts';
import { ReceiptResolution } from './ReceiptResolution.tsx';

export const SubmissionReceipts = ({
  card,
  act,
  working,
  onDirtyChange,
}: Pick<JobOverviewProps, 'card' | 'act' | 'working'> & {
  onDirtyChange?: (dirty: boolean) => void;
}) => {
  const changeDirty = useReceiptDrafts(onDirtyChange);
  // The dock verifies the latest uncertain attempt with captured evidence; its receipt keeps the
  // evidence and the outside-verification form without repeating the two verification buttons.
  const latest = card.submissionAttempts?.findLast((attempt) => attempt.status === 'uncertain');
  const docked = latest?.confirmation ? latest.id : undefined;
  return card.submissionAttempts?.length ? (
    <section className="my-4 space-y-3">
      <h3>Browser submissions</h3>
      {card.submissionAttempts.map((attempt) => (
        <div className="submission-receipt p-4" data-status={attempt.status} key={attempt.id}>
          <strong>
            {attempt.status === 'uncertain'
              ? 'Outcome needs verification'
              : attempt.status === 'confirmed'
                ? 'Submission verified'
                : 'Verified as not submitted'}
          </strong>
          <p className="quiet">
            {new Date(attempt.createdAt).toLocaleString()} · {attempt.before.url}
          </p>
          {attempt.externalConfirmation ? (
            <p className="quiet">
              User-verified external confirmation: {attempt.externalConfirmation.url} -{' '}
              {attempt.externalConfirmation.evidence}
            </p>
          ) : null}
          {attempt.evidence ? (
            <blockquote className="my-2 whitespace-pre-wrap">{attempt.evidence}</blockquote>
          ) : null}
          {attempt.confirmation ? (
            <AccordionSection heading="Full confirmation evidence">
              <p>{attempt.confirmation.url}</p>
              <SourceBlock
                label="Confirmation text"
                value={attempt.confirmation.text}
                contentClassName="font-sans"
              />
            </AccordionSection>
          ) : null}
          {attempt.status === 'uncertain' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {docked === attempt.id || !attempt.confirmation ? null : (
                <ReceiptResolution id={attempt.id} confirmed act={act} working={working} />
              )}
              <ExternalConfirmation
                id={attempt.id}
                act={act}
                working={working}
                onDirtyChange={changeDirty}
              />
              {docked === attempt.id ? null : (
                <ReceiptResolution id={attempt.id} confirmed={false} act={act} working={working} />
              )}
            </div>
          ) : null}
        </div>
      ))}
    </section>
  ) : null;
};
