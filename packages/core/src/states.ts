// Zod-free state machine and ids, safe to import from the UI bundle.
export const states = [
  'lead',
  'shortlisted',
  'drafting',
  'in_review',
  'changes_requested',
  'agreed',
  'awaiting_approval',
  'submitted',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
  'ghosted',
] as const;
export type CardState = (typeof states)[number];
export const transitions: Record<CardState, CardState[]> = {
  lead: ['shortlisted', 'withdrawn'],
  shortlisted: ['drafting', 'withdrawn'],
  drafting: ['in_review', 'changes_requested'],
  in_review: ['agreed', 'changes_requested'],
  changes_requested: ['drafting', 'withdrawn'],
  agreed: ['awaiting_approval', 'changes_requested'],
  awaiting_approval: ['agreed', 'changes_requested', 'submitted'],
  submitted: ['screening', 'interviewing', 'rejected', 'withdrawn', 'ghosted'],
  screening: ['interviewing', 'rejected', 'withdrawn', 'ghosted'],
  interviewing: ['offer', 'rejected', 'withdrawn', 'ghosted'],
  offer: ['withdrawn'],
  rejected: [],
  withdrawn: [],
  ghosted: ['screening', 'interviewing', 'withdrawn'],
};
export function assertTransition(from: CardState, to: CardState) {
  if (!transitions[from].includes(to)) throw new Error(`Cannot move ${from} to ${to}.`);
}
export const runtimeIds = ['demo', 'claude-code', 'codex', 'gemini-cli', 'opencode'] as const;
export type RuntimeId = (typeof runtimeIds)[number];
export const roleIds = ['scout', 'writer', 'reviewer'] as const;
export type RoleId = (typeof roleIds)[number];
