export const capabilityLabels = {
  messageAgents: 'Message crew members',
  invokeAgents: 'Invoke itself and other roles',
  manageWorkflow: 'Change job workflows',
  manageRoutines: 'Create, edit and delete scheduled actions',
  maintainProfile: 'Detect watched profile changes and propose reviewed updates',
  github: 'Read GitHub repositories, files and issues',
  gmail: 'Search and read Gmail',
  drive: 'Search Drive and read files and Docs',
  calendar: 'Read Google Calendar events',
  sheets: 'Read Google Sheets ranges',
  computerUse: 'Use a local browser with approval for each interaction',
};

export const capabilityDefaults = {
  messageAgents: true,
  invokeAgents: true,
  manageWorkflow: true,
  manageRoutines: true,
  maintainProfile: false,
  github: false,
  gmail: false,
  drive: false,
  calendar: false,
  sheets: false,
  computerUse: false,
};
