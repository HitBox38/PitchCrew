import { deliveryLifecycle } from '@pitchcrew/core/lifecycles';
import type { ChatRequest, Conversation, WorkQueueView, WorkspaceQueue } from '@pitchcrew/core';

export const conversationQueue = (
  queue: WorkspaceQueue | undefined,
  thread: string,
  conversations: readonly Pick<Conversation, 'id' | 'cardId'>[] = [],
) => {
  const direct = queue?.queues.find(
    (item) =>
      item.threadId === thread || item.requests.some((request) => request.threadId === thread),
  );
  const cardId = conversations.find((conversation) => conversation.id === thread)?.cardId;
  return direct ?? (cardId ? queue?.queues.find((item) => item.cardId === cardId) : undefined);
};

export const queueNeedsResume = (queue: WorkQueueView | undefined) => {
  if (queue?.paused) return true;
  const head = queue?.requests[0];
  return (
    !!head &&
    head.deliveries.some((delivery) => deliveryLifecycle.is('stopped', delivery.status)) &&
    !head.deliveries.some((delivery) => deliveryLifecycle.is('active', delivery.status))
  );
};

export const initialQueueAttention = (
  queue: WorkQueueView | undefined,
  requests: readonly ChatRequest[],
) =>
  queue?.pauseKind !== 'user' &&
  (!!queue?.paused ||
    requests.some((request) =>
      request.deliveries.some(
        (delivery) =>
          delivery.status === 'failed' || (delivery.status === 'paused' && !!delivery.runId),
      ),
    ));

export const hasUnstartedMessages = (requests: readonly ChatRequest[]) =>
  requests.some((request) =>
    request.deliveries.some(
      (delivery) => !delivery.runId && ['queued', 'paused'].includes(delivery.status),
    ),
  );

export const canEditQueuedMessage = (request: ChatRequest) =>
  !request.userInputId &&
  request.deliveries.every(
    (delivery) => !delivery.runId && deliveryLifecycle.is('unsent', delivery.status),
  );

/** A partially delivered group request is pending, never labelled wholly unsent. */
export const queueCountLabel = (requests: readonly ChatRequest[], queue?: WorkQueueView) => {
  if (queue?.paused && queue.pauseKind === 'user') {
    const counts = { waiting: 0, stopped: 0, failed: 0 };
    for (const request of requests) {
      if (request.deliveries.some((delivery) => delivery.status === 'failed')) counts.failed += 1;
      else if (hasUnstartedMessages([request])) counts.waiting += 1;
      else if (
        request.deliveries.some((delivery) => delivery.status === 'paused' && delivery.runId)
      )
        counts.stopped += 1;
    }
    const summary = Object.entries(counts)
      .filter(([, count]) => count)
      .map(([state, count]) => `${count} ${state}`);
    if (summary.length) return summary.join(' · ');
  }
  const allUnsent = requests.every((request) =>
    request.deliveries.every((delivery) => !delivery.runId),
  );
  return allUnsent
    ? `${requests.length} not sent`
    : `${requests.length} pending ${requests.length === 1 ? 'message' : 'messages'}`;
};

export const queueStateLabel = (
  queue: WorkQueueView | undefined,
  requests: readonly ChatRequest[],
  waitingForAnswer = false,
) => {
  if (
    requests.some((request) => request.deliveries.some((delivery) => delivery.status === 'failed'))
  )
    return 'Needs attention';
  if (queue?.paused)
    return queue.pauseKind === 'user'
      ? 'Paused by you'
      : queue.pauseKind === 'interrupted'
        ? 'Stopped'
        : 'Needs attention';
  return waitingForAnswer ? 'After your answer' : 'Waiting';
};

/** Store only bounded identifiers, status and an error fingerprint in device preferences. */
export const queueAttentionKeys = (requests: readonly ChatRequest[]) =>
  requests
    .flatMap((request) =>
      request.deliveries
        .filter((delivery) => deliveryLifecycle.is('stopped', delivery.status))
        .map((delivery) => {
          let hash = 0;
          for (const char of delivery.error) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
          return `${request.id}:${delivery.roleId}:${delivery.status}:${hash}`;
        }),
    )
    .sort();

export const hasNewQueueAttention = (before: readonly string[], after: readonly string[]) => {
  const seen = new Set(before);
  return after.some((key) => !seen.has(key));
};

export const hasMixedDeliveryState = (request: ChatRequest) =>
  new Set(request.deliveries.map((delivery) => delivery.status)).size > 1 ||
  request.deliveries.some((delivery) => !!delivery.error);
