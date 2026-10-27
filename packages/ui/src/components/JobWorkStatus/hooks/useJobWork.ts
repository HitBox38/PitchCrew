import { jobWorkState } from '../helpers.ts';
import type { Card } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const useJobWork = (card: Card) => {
  const pending = useWorkspaceStore((state) => state.pendingJobActions[card.id]?.[0]);
  const queue = useWorkspaceStore((state) =>
    state.data?.queue?.queues.find((queue) => queue.cardId === card.id),
  );
  const run = useWorkspaceStore((state) =>
    state.data?.runs.find(
      (run) => run.cardId === card.id && run.status === 'running' && !run.reviewSeatReservation,
    ),
  );
  return jobWorkState(card, pending, queue, run);
};
