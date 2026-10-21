import type { Snapshot } from '@pitchcrew/core';
import type { ApprovalRequest } from './types.ts';
import { browserStatusLabels } from '@/ComputerApprovals/helpers.ts';
import { packetStatusLabel, packetNeedsAction } from './helpers.ts';
import { stateLabels } from '@/lib/labels.ts';
export const requestStatus = (request: ApprovalRequest, data: Snapshot) => {
  if (request.kind === 'browser') return browserStatusLabels[request.approval.status];
  const approval = request.approval;
  const card = data.cards.find((item) => item.id === approval.cardId);
  if (
    card?.submissionAttempts?.some(
      (attempt) => attempt.exportApprovalId === approval.id && attempt.status === 'uncertain',
    )
  )
    return 'Verify submission';
  if (
    card &&
    ['submitted', 'screening', 'interviewing', 'offer', 'rejected', 'ghosted'].includes(card.state)
  )
    return stateLabels[card.state];
  if (card?.state === 'withdrawn') return 'Not applying';
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
