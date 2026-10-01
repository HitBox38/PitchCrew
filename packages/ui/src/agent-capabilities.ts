export const capabilityLabels = {
  messageAgents: 'Message crew members',
  invokeAgents: 'Invoke itself and other roles',
  manageWorkflow: 'Change job workflows',
  github: 'Read GitHub repositories, files and issues',
  gmail: 'Search and read Gmail',
  drive: 'Search Drive and read files and Docs',
  calendar: 'Read Google Calendar events',
  sheets: 'Read Google Sheets ranges',
};

export const capabilityDefaults = {
  messageAgents: true,
  invokeAgents: true,
  manageWorkflow: true,
  github: false,
  gmail: false,
  drive: false,
  calendar: false,
  sheets: false,
};
