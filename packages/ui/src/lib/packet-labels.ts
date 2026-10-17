import type { Packet } from '@pitchcrew/core';

export const packetDocumentLabels: Record<Exclude<keyof Packet, 'claims'>, string> = {
  resume: 'Resume',
  coverLetter: 'Cover letter',
  formAnswers: 'Form answers',
  note: 'Note',
};
