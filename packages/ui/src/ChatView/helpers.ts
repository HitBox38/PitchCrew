import { deliveryLifecycle } from '@pitchcrew/core/lifecycles';
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
        request.deliveries.some((delivery) => deliveryLifecycle.is('unsent', delivery.status)),
    )
    .toSorted((a, b) => a.order - b.order);
};

/** The compact snapshot blanks a settled request's text; an open editor keeps the copy it had. */
export const editorRequest = (kept: ChatRequest, fresh: ChatRequest | undefined): ChatRequest =>
  !fresh ? kept : fresh.compact ? { ...kept, deliveries: fresh.deliveries } : fresh;
