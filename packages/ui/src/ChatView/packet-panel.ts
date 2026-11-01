import type { Card, Packet } from '@pitchcrew/core';

export type PacketTab = { id: 'resume' | 'cover' | 'answers'; label: string; text: string };

/** The packet's documents in reading order; answers appear only when the form asked for them. */
export const packetTabs = (packet: Packet): PacketTab[] =>
  [
    { id: 'resume' as const, label: 'Resume', text: packet.resume },
    { id: 'cover' as const, label: 'Cover letter', text: packet.coverLetter },
    { id: 'answers' as const, label: 'Answers', text: packet.formAnswers },
  ].filter((tab) => tab.text.trim());

export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Whether the current packet passed review, from the review bound to its digest. */
export const packetReviewLabel = (card: Card) =>
  card.packetReview ? 'Reviewed by the Reviewer' : 'Not reviewed yet';
