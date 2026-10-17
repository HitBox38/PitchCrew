import type { Card } from '@pitchcrew/core';
/** Targeted readers receive the candidate resume and evidence, never peer notes or conclusions. */
export function subagentCard(card: Card): Card {
  return {
    ...card,
    feedback: [],
    packetReview: undefined,
    packet: card.packet
      ? {
          ...card.packet,
          coverLetter: '',
          formAnswers: '',
          note: '',
          claims: card.packet.claims.filter((claim) => card.packet!.resume.includes(claim.claim)),
        }
      : null,
  };
}
