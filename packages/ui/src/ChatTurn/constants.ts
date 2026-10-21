import { Check, CircleDashed, LoaderCircle, Square, X } from 'lucide-react';

export const outcomes = {
  running: 'In progress',
  completed: 'Finished',
  failed: 'Tool failed',
  interrupted: 'Outcome unavailable',
};
export const activityPresentation = {
  running: { Icon: LoaderCircle, status: 'running' },
  failed: { Icon: X, status: 'error' },
  interrupted: { Icon: CircleDashed, status: 'pending' },
  completed: { Icon: Check, status: undefined },
} as const;
export const turnPresentation = {
  running: { Icon: LoaderCircle, label: 'Working…' },
  failed: { Icon: X, label: 'Failed' },
  cancelled: { Icon: Square, label: 'Stopped' },
  waiting: { Icon: CircleDashed, label: 'Waiting for you' },
  completed: { Icon: Check, label: 'Completed' },
} as const;
