import { useEffect, useState } from 'react';
import type { CardDetailsModel } from '../types.ts';
import { JobHistory } from './JobHistory.tsx';
import { OutcomeActions } from './OutcomeActions.tsx';
import { SubmissionReceipts } from './SubmissionReceipts.tsx';
import { LearningSignals } from '@/LearningSignals/index.tsx';
import { ApplicationTracking } from '@/ApplicationTracking/index.tsx';
import { ExternalSubmissionRegistration } from '@/ExternalSubmissionRegistration/index.tsx';
import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';

export const JobActivity = (model: CardDetailsModel) => {
  const [lessonDirty, setLessonDirty] = useState(false);
  const [trackingDirty, setTrackingDirty] = useState(false);
  const [submissionDirty, setSubmissionDirty] = useState(false);
  const [receiptDirty, setReceiptDirty] = useState(false);
  const { setActivityDirty } = model;
  useEffect(() => {
    setActivityDirty(lessonDirty || trackingDirty || submissionDirty || receiptDirty);
  }, [lessonDirty, trackingDirty, submissionDirty, receiptDirty, setActivityDirty]);
  const uncertain = model.card.submissionAttempts?.some(
    (attempt) => attempt.status === 'uncertain',
  );
  return (
    <div className="detail-activity space-y-5">
      {model.card.submissionAttempts?.length ? (
        <AccordionSection heading="Submission receipts" defaultOpen={uncertain}>
          <SubmissionReceipts {...model} onDirtyChange={setReceiptDirty} />
        </AccordionSection>
      ) : null}
      <section>
        <h3>Update job status</h3>
        <p className="quiet">Record what happened. Status updates do not contact the employer.</p>
        <OutcomeActions {...model} />
      </section>
      <ExternalSubmissionRegistration card={model.card} onDirtyChange={setSubmissionDirty} />
      <AccordionSection heading="What you learned">
        <LearningSignals card={model.card} onDirtyChange={setLessonDirty} />
      </AccordionSection>
      <AccordionSection heading="Tracking evidence">
        <ApplicationTracking card={model.card} onDirtyChange={setTrackingDirty} />
      </AccordionSection>
      <AccordionSection heading="History" defaultOpen>
        <JobHistory data={model.data} card={model.card} />
      </AccordionSection>
    </div>
  );
};
