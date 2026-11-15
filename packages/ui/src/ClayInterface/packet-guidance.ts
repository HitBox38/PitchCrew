import { deliveryLifecycle } from '@pitchcrew/core/lifecycles';
import type { Approval, Card, Snapshot } from '@pitchcrew/core';
import { requestStatus } from '@/components/InboxView/status.ts';
import { packetNeedsAction } from '@/lib/inbox.ts';

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
 * The newest eligible packet approval, shared by stage labels and direct handoff navigation.
 */
export const cardPacketApproval = (card: Card, approvals: Approval[]): Approval | undefined =>
  approvals
    .filter((approval) => approval.cardId === card.id && packetNeedsAction(approval, [card]))
    .reduce<Approval | undefined>(
      (latest, approval) => (!latest || approval.createdAt >= latest.createdAt ? approval : latest),
      undefined,
    );

export const cardPacketStage = (card: Card, approvals: Approval[]): PacketStage | undefined => {
  const current = cardPacketApproval(card, approvals);
  return current ? packetStage(current, card) : undefined;
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

/** Short status for job cards and the sidebar. */
const statusLabels: Record<Exclude<PacketStage, 'preparing'>, string> = {
  approve: 'Approve packet',
  choose: 'Choose how to apply',
  apply: 'Ready to apply',
  verify: 'Verify submission',
};

/** One line for the decision's detail: what the user does now, never more than happened. */
export const packetDetails: Record<PacketStage, string> = {
  approve: 'Approve the packet',
  choose: 'Packet approved. Choose how to apply.',
  apply:
    'Files saved on this computer. Nothing has been sent. Apply on the posting, then record it.',
  preparing:
    'Handed to an agent to prepare. Nothing is submitted until you approve the final click.',
  verify: 'A submission may not have gone through. Check before recording it.',
};

/** Preparation follows its delivery (queued, running, paused, failed…) as Decisions does. */
const preparingLabel = (approval: Approval, data: Snapshot) =>
  requestStatus({ kind: 'packet', key: approval.id, approval }, data);

export const packetStatus = (approval: Approval, card: Card | undefined, data: Snapshot) => {
  const stage = packetStage(approval, card);
  return stage === 'preparing' ? preparingLabel(approval, data) : statusLabels[stage];
};

export const packetTitle = (approval: Approval, card: Card | undefined) => {
  const company = card?.company || 'this job';
  const stage = packetStage(approval, card);
  if (stage === 'approve') return `Approve the ${card?.company ? `${company} ` : ''}packet?`;
  if (stage === 'choose') return `Choose how to apply to ${company}`;
  if (stage === 'apply') return `Apply to ${company}, then record it`;
  if (stage === 'verify') return `Did the ${company} application go through?`;
  return `Check on the ${company} application`;
};

/** The deck's one action: review a pending packet, otherwise continue the application. */
export const packetAction = (stage: PacketStage | undefined) =>
  !stage || stage === 'approve'
    ? 'Review'
    : stage === 'verify'
      ? 'Check submission'
      : 'Continue application';
