import type { Packet } from '@pitchcrew/core';

export const packetDocumentLabels: Record<Exclude<keyof Packet, 'claims'>, string> = {
  resume: 'Resume',
  coverLetter: 'Cover letter',
  formAnswers: 'Form answers',
  note: 'Note',
};

/**
 * Readable words in a document: runs that start with a letter or digit, so Markdown markers
 * (`#`, `-`, `**`) never count. The chat Packet panel and file tiles share this one rule.
 */
export const readableWordCount = (text: string) =>
  (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
