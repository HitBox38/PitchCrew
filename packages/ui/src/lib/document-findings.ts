import type { DocumentFinding } from '@pitchcrew/core';

/**
 * The unpaged warning every Word file's verification carries (see packet's word-caveat.ts; a unit
 * test keeps the two in step). It is stated once as the Word layout notice, never as a layout note.
 */
export const wordLayoutCaveat =
  'Word controls final DOCX layout. Page counts are estimates; layout is not verified.';

/** The Word layout notice: the caveat as shown, once, wherever Word files are listed or viewed. */
export const wordLayoutNotice = 'Browser preview: Word’s layout and page count may differ.';

export const isWordLayoutCaveat = (finding: DocumentFinding) =>
  finding.check === 'layout' && finding.message === wordLayoutCaveat;

/** A file's own layout notes: its verification findings without the shared Word caveat. */
export const fileNotes = (findings: DocumentFinding[] | undefined) =>
  findings?.filter((finding) => !isWordLayoutCaveat(finding));

/** "2 layout notes · 1 error": the count, with errors named in words as well as colour. */
export const notesLabel = (findings: DocumentFinding[]) => {
  const errors = findings.filter((finding) => finding.severity === 'error').length;
  return `${findings.length} layout note${findings.length === 1 ? '' : 's'}${
    errors ? ` · ${errors} error${errors === 1 ? '' : 's'}` : ''
  }`;
};
