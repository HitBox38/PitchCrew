import { capabilityDefaults } from '../agent-capabilities.ts';

export const creationSteps = [
  'Purpose',
  'Runtime',
  'Tools',
  'Skills',
  'Routine',
  'Review',
] as const;
export const workflowOptions = [
  { value: 'chat', label: 'Chat and tools' },
  { value: 'scout', label: 'Evaluate job fit' },
  { value: 'writer', label: 'Draft application packets' },
  { value: 'reviewer', label: 'Review application packets' },
];
export const newAgentCapabilities = {
  ...capabilityDefaults,
  messageAgents: false,
  invokeAgents: false,
  manageWorkflow: false,
  manageRoutines: false,
};
export const toolGroups = [
  {
    title: 'Crew coordination',
    keys: ['messageAgents', 'invokeAgents', 'manageWorkflow', 'manageRoutines'],
  },
  { title: 'Connected services', keys: ['github', 'gmail', 'drive', 'calendar', 'sheets'] },
  {
    title: 'Applications and learning',
    keys: ['readApplications', 'trackApplications', 'reviewPipeline', 'proposeCrewChanges'],
  },
  { title: 'Profile maintenance', keys: ['maintainProfile'] },
  { title: 'Browser and forms', keys: ['computerUse', 'assessForms', 'recordSubmissions'] },
] as const;
export const toolHelp = {
  messageAgents: 'Save messages in crew chats.',
  invokeAgents: 'Queue follow-ups after the current turn, up to six per chain.',
  manageWorkflow: 'Update the attached job within its allowed workflow.',
  manageRoutines: 'Manage schedules. Cross-role schedules also require invoking agents.',
  github: 'Read-only access through your connected GitHub account.',
  gmail: 'Read-only email access through your connected Google account.',
  drive: 'Read-only access to Drive files and Docs.',
  calendar: 'Read-only access to calendar events.',
  sheets: 'Read-only access to spreadsheet ranges.',
  readApplications: 'Read across the applications database, beyond an attached job.',
  trackApplications:
    'Requires Gmail access and a connected Google account. Ambiguous evidence needs your review.',
  reviewPipeline: 'Read applications, run history and role configurations across the crew.',
  proposeCrewChanges:
    'Requires pipeline review. Alert you first, then propose changes for your approval.',
  maintainProfile:
    'Requires GitHub or Drive access and watched sources set up in Profile. Every update needs your review.',
  computerUse: 'Open an isolated browser. Each interaction needs your exact-action approval.',
  assessForms: 'Requires browser access. Inspect fields and report what an application form needs.',
  recordSubmissions:
    'Requires browser access. Submission actions and exported documents still need approval; confirmation must be verified.',
};
