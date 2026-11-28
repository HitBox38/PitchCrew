import type { Snapshot } from '@pitchcrew/core';
import type { ApprovalRequest } from './types.ts';
import { browserStatusLabel } from '@/ComputerApprovals/helpers.ts';
import { packetStatusLabel, packetNeedsAction } from './helpers.ts';
import { stateLabels } from '@/lib/labels.ts';
import { postSubmissionStates } from '@/lib/job-step.ts';
export const requestStatus = (request: ApprovalRequest, data: Snapshot) => {
  if (request.kind === 'browser') return browserStatusLabel(request.approval);
  const approval = request.approval;
  const card = data.cards.find((item) => item.id === approval.cardId);
  if (
    card?.submissionAttempts?.some(
      (attempt) => attempt.exportApprovalId === approval.id && attempt.status === 'uncertain',
    )
  )
    return 'Verify submission';
  if (card?.state === 'withdrawn') return 'Not applying';
  if (card && postSubmissionStates.has(card.state)) return stateLabels[card.state];
  if (!packetNeedsAction(approval, data.cards))
    return approval.status === 'rejected' ? 'Rejected' : 'Completed or superseded';
  if (approval.submission?.method === 'manual') return 'Ready for you to submit';
  if (approval.submission?.requestId) {
    const delivery = data.chatRequests?.find((item) => item.id === approval.submission?.requestId)
      ?.deliveries[0];
    return delivery
      ? {
          queued: 'Preparation queued',
          running: 'Agent preparing',
          waiting: 'Waiting for your answer',
          paused: 'Preparation paused',
          failed: 'Preparation needs attention',
          completed: 'Review application progress',
          cancelled: 'Preparation stopped',
        }[delivery.status]
      : 'Continue application';
  }
  return approval.status === 'consumed'
    ? 'Choose how to submit'
    : packetStatusLabel(approval.status);
};
