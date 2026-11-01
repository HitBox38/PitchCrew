export const outcomes = {
  running: 'In progress',
  completed: 'Finished',
  failed: 'Tool failed',
  interrupted: 'Outcome unavailable',
};
export const activityPresentation = {
  running: { status: 'running' },
  failed: { status: 'error' },
  interrupted: { status: 'pending' },
  completed: { status: undefined },
} as const;
export const turnPresentation = {
  running: { label: 'Working…' },
  failed: { label: 'Failed' },
  cancelled: { label: 'Stopped' },
  waiting: { label: 'Waiting for you' },
  completed: { label: 'Completed' },
} as const;
