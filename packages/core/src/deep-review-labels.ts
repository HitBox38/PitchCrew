// Shared renderer vocabulary; deliberately free of schema/runtime dependencies.
export const reviewPerspectives = {
  screen: 'Automated screen',
  interview: 'Hiring manager: interview decision',
  readiness: 'Hiring manager: day-one readiness',
  rival: 'Rival applicant',
  ceo: 'CEO',
  recruiter: 'Recruiter',
  teammate: 'Teammate',
  relevance: 'Job relevance specialist',
  readability: 'Recruiter readability specialist',
  impact: 'Demonstrated impact specialist',
  collaboration: 'Collaboration specialist',
} as const;
export type ReviewPerspective = keyof typeof reviewPerspectives;
export const originalReviewPerspectives = [
  'screen',
  'interview',
  'readiness',
  'rival',
  'ceo',
  'recruiter',
  'teammate',
] as const;
export const deepReviewStages = {
  draft: 'Creating first draft',
  review: 'Reviewing resume',
  correction: 'Correcting resume',
  recheck: 'Rechecking packet',
} as const;
