/** Packet documents that house rules can check. Claims are always checked separately. */
export const packetDocuments = ['resume', 'coverLetter', 'formAnswers', 'note'] as const;
export type PacketDocument = (typeof packetDocuments)[number];
export const packetDocumentLabels: Record<PacketDocument, string> = {
  resume: 'Resume',
  coverLetter: 'Cover letter',
  formAnswers: 'Form answers',
  note: 'Note',
};

/** Character limits for packet text. Writer prompts state them so a returned packet fits. */
export const packetTextLimits = {
  resume: 20000,
  coverLetter: 12000,
  formAnswers: 12000,
  note: 12000,
} as const satisfies Record<PacketDocument, number>;
