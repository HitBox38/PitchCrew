import type { AgentTask } from '@pitchcrew/core';

export const taskLabels: Record<AgentTask['status'], string> = {
  waiting: 'Waiting for continuation',
  queued: 'Queued',
  running: 'Working',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Stopped',
};
