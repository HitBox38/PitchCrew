import { profileFile } from './constants';
import type { Claim } from './types';

export const writerNote = (claim: Claim) => {
  return claim.verdict === 'revised'
    ? `Rewrote this line after Reviewer’s request, using line ${claim.line} of your notes instead of the first draft.`
    : `Used line ${claim.line} of your notes as written. Added no new facts.`;
};

export const announcement = (claim: Claim) => {
  return `${claim.text} Reviewer: ${claim.note} Source: ${profileFile}, line ${claim.line}.`;
};
