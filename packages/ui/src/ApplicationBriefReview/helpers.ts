import type { ExtractedJob } from '@pitchcrew/core';
export const emptyBrief = (): ExtractedJob => ({
  brief: { companyContext: '', responsibilities: [], qualifications: [], constraints: [] },
  requirements: [],
  flagged: [],
});
export const splitLines = (text: string) => text.split('\n');
export const normalizedBrief = (draft: ExtractedJob): ExtractedJob => ({
  ...draft,
  brief: {
    ...draft.brief,
    responsibilities: draft.brief.responsibilities.map((line) => line.trim()).filter(Boolean),
    qualifications: draft.brief.qualifications.map((line) => line.trim()).filter(Boolean),
    constraints: draft.brief.constraints.map((line) => line.trim()).filter(Boolean),
  },
});
