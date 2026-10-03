export const eventKindLabels = {
  card: 'Jobs',
  role: 'Roles',
  run: 'Runs',
  approval: 'Packet approvals',
  message: 'Messages',
  proposal: 'Role suggestions',
  task: 'Follow-ups',
  routine: 'Routines',
  skill: 'Skills',
  skill_proposal: 'Skill suggestions',
  computer_approval: 'Browser approvals',
  form_assessment: 'Form assessments',
  submission_attempt: 'Submission receipts',
} as const;

export const actorLabels: Record<string, string> = {
  user: 'You',
  demo: 'Demo runtime',
  system: 'Pitchcrew',
  mcp: 'Crew tools',
  scout: 'Scout',
  writer: 'Writer',
  reviewer: 'Reviewer',
};
