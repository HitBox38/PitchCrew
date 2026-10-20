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
    keys: [
      'readApplications',
      'manageCareerPlans',
      'trackApplications',
      'reviewPipeline',
      'proposeCrewChanges',
    ],
  },
  { title: 'Job discovery', keys: ['discoverJobs'] },
  { title: 'Profile maintenance', keys: ['maintainProfile'] },
  { title: 'Browser and forms', keys: ['computerUse', 'assessForms', 'recordSubmissions'] },
] as const;
export const toolHelp = {
  messageAgents: 'Save messages in crew chats.',
  invokeAgents: 'Queue follow-ups after the current turn, up to six per chain.',
  manageWorkflow:
    'List board jobs, move them between any statuses and delete them, individually or in bulk.',
  manageRoutines: 'Manage schedules. Cross-role schedules also require invoking agents.',
  github: 'Read-only access through your connected GitHub account.',
  gmail: 'Read-only email access through your connected Google account.',
  drive: 'Read-only access to Drive files and Docs.',
  calendar: 'Read-only access to calendar events.',
  sheets: 'Read-only access to spreadsheet ranges.',
  readApplications: 'Read across the applications database, beyond an attached job.',
  manageCareerPlans:
    'Requires application reads. Refresh chosen career plans and record user-reported action progress.',
  trackApplications:
    'Requires Gmail access and a connected Google account. Ambiguous evidence needs your review.',
  reviewPipeline: 'Read applications, run history and role configurations across the crew.',
  proposeCrewChanges:
    'Requires pipeline review. Alert you first, then propose changes for your approval.',
  discoverJobs:
    'Scan saved sources, add leads from public posting links or refresh an existing job from its link. Pages requiring login or JavaScript may need pasted posting text. Agents cannot change sources.',
  maintainProfile:
    'Requires GitHub or Drive access and watched sources set up in Profile. Every update needs your review.',
  computerUse:
    'Open this agent’s local browser in chat. Supervised mode asks for each interaction; bounded autonomous preparation is optional.',
  assessForms: 'Requires browser access. Inspect fields and report what an application form needs.',
  recordSubmissions:
    'Requires browser access. Submission actions and exported documents still need approval; confirmation must be verified.',
};
