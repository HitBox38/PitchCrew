import type { ChatRequest } from '@pitchcrew/core';

export const messageDay = (date: string) => {
  const value = new Date(date);
  if (value.toDateString() === new Date().toDateString()) return 'Today';
  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: value.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
};

export const queuedChatRequests = (requests: ChatRequest[], thread: string) => {
  return requests
    .filter(
      (request) =>
        request.threadId === thread &&
        request.deliveries.some((delivery) =>
          ['queued', 'paused', 'failed'].includes(delivery.status),
        ),
    )
    .toSorted((a, b) => a.order - b.order);
};
