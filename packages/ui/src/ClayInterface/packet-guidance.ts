import type { Approval, Card, Snapshot } from '@pitchcrew/core';
import { requestStatus } from '@/components/InboxView/status.ts';
import { packetNeedsAction } from '@/lib/inbox.ts';
import { packetStage, type PacketStage } from '@/lib/packet-stage.ts';

// Moved to lib so the attention model can read them; re-exported for existing importers.
export { packetStage, packetWaitsOnUser, type PacketStage } from '@/lib/packet-stage.ts';

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

/** The verify stage's question, which Home also asks of every uncertain submission. */
export const verifyTitle = (card: Card | undefined) =>
  `Did the ${card?.company || 'this job'} application go through?`;

export const packetTitle = (approval: Approval, card: Card | undefined) => {
  const company = card?.company || 'this job';
  const stage = packetStage(approval, card);
  if (stage === 'approve') return `Approve the ${card?.company ? `${company} ` : ''}packet?`;
  if (stage === 'choose') return `Choose how to apply to ${company}`;
  if (stage === 'apply') return `Apply to ${company}, then record it`;
  if (stage === 'verify') return verifyTitle(card);
  return `Check on the ${company} application`;
};
