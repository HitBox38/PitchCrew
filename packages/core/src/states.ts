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
export const runtimeIds = [
  'demo',
  'claude-code',
  'codex',
  'gemini-cli',
  'opencode',
  'copilot-cli',
  'cursor-agent',
  'goose',
  'kiro-cli',
  'grok',
  'pi',
  'oh-my-pi',
  'hermes',
] as const;
export type RuntimeId = (typeof runtimeIds)[number];
export const roleIds = ['scout', 'writer', 'reviewer'] as const;
export const defaultRoleIds = [
  ...roleIds,
  'submitter',
  'tracker',
  'documenter',
  'pipeline-coach',
] as const;
export type WorkflowSeat = (typeof roleIds)[number];
export type RoleId = string;
export function isRoleId(value: string): boolean {
  return (
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) &&
    value.length <= 48 &&
    ![
      'crew',
      'user',
      'system',
      'all',
      'shared',
      'con',
      'prn',
      'aux',
      'nul',
      'clock',
      'com1',
      'com2',
      'com3',
      'com4',
      'com5',
      'com6',
      'com7',
      'com8',
      'com9',
      'lpt1',
      'lpt2',
      'lpt3',
      'lpt4',
      'lpt5',
      'lpt6',
      'lpt7',
      'lpt8',
      'lpt9',
    ].includes(value)
  );
}
export function workflowSeat(role: {
  id: RoleId;
  workflow?: WorkflowSeat | 'chat';
}): WorkflowSeat | 'chat' {
  return (
    role.workflow ??
    (roleIds.includes(role.id as WorkflowSeat) ? (role.id as WorkflowSeat) : 'chat')
  );
}
