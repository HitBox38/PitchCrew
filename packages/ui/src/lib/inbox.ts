import type { Approval, Snapshot } from '@pitchcrew/core';
export const packetNeedsAction = (approval: Approval, cards?: Snapshot['cards']) => {
  if (approval.status === 'rejected') return false;
  if (!cards) return ['pending', 'approved'].includes(approval.status);
  const card = cards.find((item) => item.id === approval.cardId);
  if (!card || card.state !== 'awaiting_approval') return false;
  if (approval.contextRevision !== card.applicationContext?.revision) return false;
  return JSON.stringify(approval.packet) === JSON.stringify(card.packet);
};
