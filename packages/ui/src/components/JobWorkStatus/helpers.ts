import type { Card, Run, WorkQueueView } from '@pitchcrew/core';
import type { PendingJobAction } from '../../WorkspaceStore/job-actions.ts';

export const jobWorkState = (
  card: Card,
  pending?: PendingJobAction,
  queue?: WorkQueueView,
  run?: Run,
) => {
  const request = queue?.requests.find((request) =>
    request.deliveries.some((delivery) => !['completed', 'cancelled'].includes(delivery.status)),
  );
  const starting = !!request && !run && !card.owner;
  // A delivery is reserved before authentication and file setup, before it has a Run.
  const preparing =
    starting && request.deliveries.some((delivery) => delivery.status === 'running');
  const spinning = !!pending || !!run || !!card.owner || preparing;
  let label: string | null = null;
  if (pending) label = pending.label;
  else if (run || card.owner) label = 'Agent working…';
  else if (preparing) label = 'Starting agent…';
  else if (starting)
    label =
      queue?.state === 'ready'
        ? 'Agent queued'
        : queue?.state === 'waiting'
          ? 'Waiting for you'
          : 'Agent on hold';
  return {
    pending,
    starting,
    spinning,
    label,
    reason: starting ? queue?.reason : undefined,
    roleId: run?.roleId ?? card.owner,
  };
};
