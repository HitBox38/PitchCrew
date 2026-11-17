import { computerApprovalLifecycle } from '@pitchcrew/core/lifecycles';
import type { Approval, ComputerApproval, Snapshot } from '@pitchcrew/core';
export const packetNeedsAction = (approval: Approval, cards?: Snapshot['cards']) => {
  if (approval.status === 'rejected') return false;
  if (!cards) return ['pending', 'approved'].includes(approval.status);
  const card = cards.find((item) => item.id === approval.cardId);
  if (!card || card.state !== 'awaiting_approval') return false;
  if (approval.contextRevision !== card.applicationContext?.revision) return false;
  return JSON.stringify(approval.packet) === JSON.stringify(card.packet);
};

/**
 * A browser request waiting on the user: asked, or approved by them and not yet carried out. The
 * server's automatic approvals (a browser mode or a task site grant) are created approved and were
 * never the user's decision, so they never wait on them.
 */
export const browserNeedsAction = (approval: Pick<ComputerApproval, 'status' | 'automatic'>) =>
  !approval.automatic && computerApprovalLifecycle.is('open', approval.status);
