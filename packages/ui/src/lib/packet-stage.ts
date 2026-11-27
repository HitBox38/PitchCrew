import { deliveryLifecycle } from '@pitchcrew/core/lifecycles';
import type { Approval, Card, Snapshot } from '@pitchcrew/core';

/**
 * Where a packet decision that still needs the user actually stands. Attention eligibility stays
 * with `packetNeedsAction`; this only words it: a pending packet waits for approval, an approved
 * one for the user to choose how to apply, an exported manual handoff for the user to apply and
 * then record it, an agent handoff for its preparation, and an uncertain browser submission for the
 * user to check it. A manual export never means the application was sent.
 */
export type PacketStage = 'approve' | 'choose' | 'apply' | 'preparing' | 'verify';

export const packetStage = (approval: Approval, card: Card | undefined): PacketStage => {
  if (approval.status === 'pending') return 'approve';
  if (
    card?.submissionAttempts?.some(
      (attempt) => attempt.exportApprovalId === approval.id && attempt.status === 'uncertain',
    )
  )
    return 'verify';
  // The daemon records the manual choice only after verifying the exported files.
  if (
    approval.submission?.method === 'manual' &&
    approval.status === 'consumed' &&
    approval.exportDirectory
  )
    return 'apply';
  if (approval.submission?.method === 'agent') return 'preparing';
  return 'choose';
};

/**
 * Whether a packet decision is the user's move. Only queued or running preparation has an agent
 * next; stopped, completed, missing or waiting deliveries need the user to check progress.
 */
export const packetWaitsOnUser = (approval: Approval, card: Card | undefined, data: Snapshot) => {
  if (packetStage(approval, card) !== 'preparing') return true;
  const requestId = approval.submission?.requestId;
  const delivery = data.chatRequests?.find((item) => item.id === requestId)?.deliveries[0];
  return !delivery || !deliveryLifecycle.is('moving', delivery.status);
};
