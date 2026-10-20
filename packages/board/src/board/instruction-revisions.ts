import { createHash } from 'node:crypto';

/** Whitespace-only differences never count as edits: runs of spaces, tabs and newlines compare equal. */
export const normalizeInstructions = (text: string): string => {
  return text.replace(/\s+/g, ' ').trim();
};

/** Stable revision identifier for an instruction text. */
export const instructionRevision = (text: string): string => {
  return createHash('sha256').update(normalizeInstructions(text)).digest('hex').slice(0, 16);
};
