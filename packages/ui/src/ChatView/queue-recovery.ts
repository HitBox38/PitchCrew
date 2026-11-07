import type { ChatRequest, WorkQueueView } from '@pitchcrew/core';

/** Recovery uses the existing request command: completed recipients are never retried. */
export const requestRecovery = (request: ChatRequest) => {
  const unfinished = request.deliveries.filter((delivery) =>
    ['paused', 'failed'].includes(delivery.status),
  );
  if (!unfinished.length) return null;
  const retry = unfinished.some((delivery) => !!delivery.runId || delivery.status === 'failed');
  return {
    retry,
    label: retry ? 'Retry unfinished replies' : 'Resume message',
    description: request.deliveries.some((delivery) => delivery.status === 'completed')
      ? `Finished replies stay saved. Only unfinished replies ${retry ? 'run again' : 'are sent'}, then messages that have not started continue.`
      : retry
        ? 'Retry the unfinished replies, then continue messages that have not started.'
        : 'Send this waiting message and continue the queue.',
  };
};

/** Choose one affected request, never turn a failed queue into an implicit bulk retry. */
export const queueRecoveryRequest = (requests: readonly ChatRequest[]) => {
  const head = requests.find((request) =>
    request.deliveries.some((delivery) => !['completed', 'cancelled'].includes(delivery.status)),
  );
  return head && requestRecovery(head) ? head : undefined;
};

export const queueExplanation = (queue: WorkQueueView | undefined) => {
  if (!queue?.paused) return null;
  if (queue.pauseKind === 'user')
    return queue.cardId
      ? 'Paused by you. Resume queue continues this job’s waiting work in order.'
      : 'Paused by you. Resume all continues messages that have not started; stopped replies are not retried.';
  return queue.pauseKind === 'interrupted'
    ? 'Work stopped before it finished. Retry an unfinished message to continue; finished replies stay saved.'
    : 'A reply could not finish. Retry the affected message when you’re ready; finished replies stay saved.';
};
