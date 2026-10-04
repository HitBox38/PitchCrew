export const documentLabels: Record<string, string> = {
  resume: 'Resume',
  coverLetter: 'Cover letter',
  formAnswers: 'Form answers',
  note: 'Note',
};
export const kindLabels: Record<string, string> = {
  word_limit: 'Word limit',
  max_bullets: 'Bullets per section',
  canonical_lines: 'Listed lines',
  pattern: 'Pattern',
};
export const rulesFileName = 'packet-rules.json';
/** Matches the daemon's file limit so oversized imports fail before upload. */
export const rulesFileBytes = 256 * 1024;
export const validationDelay = 300;
