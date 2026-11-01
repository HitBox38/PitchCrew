import type { Snapshot } from '@pitchcrew/core';
import { stateLabels } from '../../lib/labels.ts';
import type { ApprovalRequest } from './types.ts';

export type OutcomeTone = 'teal' | 'quiet' | 'rose';
export type DecisionOutcome = { label: string; tone: OutcomeTone };

const packetOutcomes: Record<string, DecisionOutcome> = {
  pending: { label: 'Expired', tone: 'quiet' },
  approved: { label: 'Approved, not exported', tone: 'teal' },
  consumed: { label: 'Approved', tone: 'teal' },
  rejected: { label: 'Rejected', tone: 'quiet' },
};
const browserOutcomes: Record<string, DecisionOutcome> = {
  pending: { label: 'Expired', tone: 'quiet' },
  approved: { label: 'Approved, not used', tone: 'teal' },
  consumed: { label: 'Approved', tone: 'teal' },
  rejected: { label: 'Rejected', tone: 'quiet' },
  failed: { label: 'Approved, then failed', tone: 'rose' },
};

/** The saved result of the decision itself, independent of how the job moved on afterwards. */
export const decisionOutcome = (request: ApprovalRequest): DecisionOutcome =>
  (request.kind === 'packet' ? packetOutcomes : browserOutcomes)[request.approval.status] ?? {
    label: 'Decided',
    tone: 'quiet',
  };

/** Where the job stands now, as quiet metadata beside the outcome. */
export const decisionStage = (
  request: ApprovalRequest,
  data: Pick<Snapshot, 'cards'>,
): { label: string; attention?: true } | undefined => {
  const card = data.cards.find((item) => item.id === request.approval.cardId);
  if (!card) return request.kind === 'packet' ? { label: 'Job removed' } : undefined;
  const uncertain = card.submissionAttempts?.some(
    (attempt) =>
      attempt.status === 'uncertain' &&
      (request.kind === 'browser' || attempt.exportApprovalId === request.approval.id),
  );
  if (uncertain) return { label: 'Verify submission', attention: true };
  return { label: stateLabels[card.state] };
};
