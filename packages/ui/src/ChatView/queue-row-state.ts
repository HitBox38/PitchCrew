import type { ChatRequest, Snapshot } from '@pitchcrew/core';

export const queueRowState = (request: ChatRequest, data: Snapshot) => {
  const queue = data.queue?.queues.find((item) =>
    item.requests.some((entry) => entry.id === request.id),
  );
  return {
    queue,
    queuePaused: queue?.paused ?? false,
    canResume:
      (!queue?.requests.length || queue.requests[0]?.id === request.id) &&
      !queue?.tasks.some((task) => task.status === 'failed'),
    reordering: !request.deliveries.some((delivery) =>
      ['running', 'waiting'].includes(delivery.status),
    ),
    busy: data.runs.some((run) => run.status === 'running' && run.threadId === request.threadId),
    occupying: request.deliveries.some((delivery) =>
      data.runs.some(
        (run) =>
          run.status === 'running' &&
          run.roleId === delivery.roleId &&
          run.threadId !== request.threadId,
      ),
    ),
  };
};
