import type { AgentTask, DelegationRound } from '@pitchcrew/core';
import type { BeadStatus } from '@/ClayInterface/helpers.ts';

export const roundStatusLabels: Record<DelegationRound['status'], string> = {
  queued: 'Waiting to start',
  running: 'Delegates working',
  collecting: 'Collecting results',
  completed: 'Collected',
  cancelled: 'Stopped',
};

/** One row per delegate plus the collection turn, each with its task state for a bead. */
export const roundMembers = (round: DelegationRound, tasks: AgentTask[]) => {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const member = (taskId: string, roleId: string, part: 'delegate' | 'collection') => {
    const task = byId.get(taskId);
    return {
      key: taskId,
      roleId,
      part,
      status: (task?.status ?? 'queued') as BeadStatus,
      threadId: task?.threadId ?? round.threadId,
      runId: task?.runId ?? null,
      content: task?.content ?? '',
      error: task?.error ?? '',
    };
  };
  return [
    ...round.delegates.map((delegate) => member(delegate.taskId, delegate.roleId, 'delegate')),
    member(round.collectionTaskId, round.leadId, 'collection'),
  ];
};
/** A bead for the whole round: the collection's own state once delegates settle. */
export const roundBead = (round: DelegationRound): BeadStatus =>
  round.status === 'completed'
    ? 'completed'
    : round.status === 'cancelled'
      ? 'cancelled'
      : round.status === 'queued'
        ? 'queued'
        : 'running';
