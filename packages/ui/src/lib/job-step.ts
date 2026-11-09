import type { Approval, Card } from '@pitchcrew/core';

/**
 * The next application move for a job at rest (no agent running, nothing pending in the queue).
 * Job details' footer action and the stage line under job chats and job details both read this,
 * so the line and the button never name different steps. Runs, questions and decisions are
 * resolved by their callers first; this only orders the brief, form, fit, packet and outcome gates.
 */
export type JobStep =
  | 'prepare-brief'
  | 'confirm-brief'
  | 'check-form'
  | 'answer-requirements'
  | 'evaluate-fit'
  | 'shortlist'
  | 'draft'
  | 'revise'
  | 'drafting'
  | 'review'
  | 'export'
  | 'approve'
  | 'apply'
  | 'outcome';

export type JobStepFacts = {
  /** An extracted or manually prepared brief exists. */
  hasBrief: boolean;
  /** The current brief revision (and its form choice) is confirmed by the user. */
  briefConfirmed: boolean;
  /** A linked application has neither an inspected form nor the user's manual-check choice. */
  formMissing: boolean;
  /** A required personal answer in the brief is still empty. */
  missingAnswers: boolean;
  /** The current packet has been exported through a consumed approval. */
  exported: boolean;
};

export const postSubmissionStates: ReadonlySet<Card['state']> = new Set([
  'submitted',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'ghosted',
  'withdrawn',
]);

export const packetNeedsReview = (card: Card) =>
  Boolean(
    card.packet &&
    (!card.packetReview || card.packetReview.contextRevision !== card.applicationContext?.revision),
  );

/** The current packet left Pitchcrew through a consumed export approval. */
export const packetExported = (card: Card, approvals: Approval[]) =>
  approvals.some(
    (approval) =>
      approval.cardId === card.id &&
      approval.status === 'consumed' &&
      !!approval.exportDirectory &&
      JSON.stringify(approval.packet) === JSON.stringify(card.packet),
  );

type InspectedForm = Extract<
  NonNullable<NonNullable<Card['applicationContext']>['form']>,
  {
    status: 'inspected';
  }
>;

/**
 * Employer requirement metadata in a fixed key order, without `missingAnswer`: resolving an answer
 * is preparation progress, not a changed requirement. Mirrors `applicationFormIsCurrent` in
 * `@pitchcrew/core/application-form`, which the UI cannot import at runtime without bundling zod.
 */
const requirementKey = (form: Omit<InspectedForm, 'status'>) =>
  JSON.stringify([
    form.url,
    form.fields.map((field) => [
      field.label,
      field.type,
      field.required,
      field.visible,
      field.disabled,
      field.accept,
      field.options,
      field.maxLength ?? null,
      field.assessed,
      field.condition,
    ]),
    form.blockers,
    form.uninspected,
  ]);

/** Whether the adopted form choice still matches the latest inspected form requirements. */
export const formIsCurrent = (card: Card) => {
  const form = card.applicationContext?.form;
  const assessment = card.formAssessments?.at(-1);
  if (!form) return !card.url && !assessment;
  if (form.status === 'manual') return !assessment;
  if (!assessment) return false;
  return (
    requirementKey(form) ===
    requirementKey({
      url: assessment.page.url,
      fields: assessment.fields,
      blockers: assessment.blockers,
      uninspected: [
        ...assessment.uninspected,
        ...(!assessment.fields.length ? ['No application controls were inspected.'] : []),
      ],
    })
  );
};

/**
 * Facts from the workspace snapshot alone. Job details replaces the brief facts with the loaded
 * application context, which also compares the source revision the snapshot does not carry.
 */
export const snapshotStepFacts = (card: Card, approvals: Approval[]): JobStepFacts => {
  const context = card.applicationContext;
  const inspected = !!card.formAssessments?.length;
  return {
    hasBrief: !!context,
    // Changed inspected requirements (or a newer inspection than a manual choice) need confirming.
    briefConfirmed: Boolean(
      context?.confirmedAt && context.confirmedRevision === context.revision && formIsCurrent(card),
    ),
    formMissing: !!card.url && !context?.form && !inspected,
    missingAnswers: !!context?.requirements.some(
      (entry) => entry.required && entry.personal && !entry.answer.trim(),
    ),
    exported: packetExported(card, approvals),
  };
};

export const jobStep = (card: Card, facts: JobStepFacts): JobStep | null => {
  if (postSubmissionStates.has(card.state)) return 'outcome';
  if (card.state === 'lead') {
    if (!facts.hasBrief) return 'prepare-brief';
    // Fit only needs the extracted brief. Confirming it (and the form) gates drafting, so a lead
    // is never held on confirmation: that check comes back once the job is shortlisted.
    return card.fit === null || card.fit === undefined ? 'evaluate-fit' : 'shortlist';
  }
  if (facts.formMissing) return 'check-form';
  if (!facts.hasBrief) return 'prepare-brief';
  if (!facts.briefConfirmed) return 'confirm-brief';
  if (facts.missingAnswers) return 'answer-requirements';
  if (card.state === 'shortlisted') return 'draft';
  // A failed first draft also lands in changes_requested; with no packet saved there is nothing
  // to revise, so the next move is drafting the first packet again.
  if (card.state === 'changes_requested') return card.packet ? 'revise' : 'draft';
  if (card.state === 'drafting') return 'drafting';
  if (card.state === 'in_review' || packetNeedsReview(card)) return 'review';
  if (card.state === 'agreed') return 'export';
  if (card.state === 'awaiting_approval') return facts.exported ? 'apply' : 'approve';
  return null;
};

/** What the user does once the employer has the application, by its recorded status. */
export const outcomeHints: Partial<Record<Card['state'], string>> = {
  submitted: 'Record their reply when it arrives.',
  screening: 'Prepare for screening, then record how it went.',
  interviewing: 'Prepare for your interviews, then record the outcome.',
  offer: 'Review the offer, then record your decision.',
};
