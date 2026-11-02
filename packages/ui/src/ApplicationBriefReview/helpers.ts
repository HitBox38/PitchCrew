import type { ExtractedJob } from '@pitchcrew/core';
import type { ContextResponse } from './types.ts';
export const emptyBrief = (): ExtractedJob => ({
  brief: { companyContext: '', responsibilities: [], qualifications: [], constraints: [] },
  requirements: [],
  flagged: [],
});
/** Use the same server baseline for initialization, cancellation and dirty checks. */
export const briefFromContext = (loaded: ContextResponse): ExtractedJob =>
  loaded.context
    ? {
        brief: loaded.context.brief,
        requirements: loaded.context.requirements,
        flagged: loaded.context.flagged,
        form: loaded.form ?? loaded.context.form,
      }
    : { ...emptyBrief(), flagged: loaded.flagged, form: loaded.form ?? undefined };
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
