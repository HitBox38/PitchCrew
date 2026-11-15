import type { ChatRequest, Conversation, Snapshot, WorkQueueView } from '@pitchcrew/core';
import { conversationQueue, hasUnstartedMessages, queueNeedsResume } from './queue-presentation.ts';
import { queueRecoveryRequest, requestRecovery } from './queue-recovery.ts';

export type QueueHold = 'resume' | 'retry' | 'review';

export const conversationQueueHold = (
  data: Pick<Snapshot, 'queue' | 'conversations'>,
  thread: string,
) => {
  const queue = conversationQueue(data.queue, thread, data.conversations);
  return queueRecoveryPlan(
    queue,
    queue?.requests.filter((request) => request.threadId === thread) ?? [],
    thread,
    data.conversations,
  )?.hold;
};
type RecoveryBase = { label: string; title: string; hold: QueueHold };
export type QueueRecoveryPlan = RecoveryBase &
  (
    | { kind: 'resume'; path: string }
    | { kind: 'request'; request: ChatRequest; path: string }
    | { kind: 'chat'; thread: string; explanation: string }
    | { kind: 'queue'; explanation: string }
  );

/** Mirrors the existing global Resume command; attempted failures still require individual review. */
const canResumeQueue = (queue: WorkQueueView | undefined) =>
  !!queue?.paused &&
  queue.pauseKind === 'user' &&
  hasUnstartedMessages(queue.requests) &&
  !queue.requests.some((request) =>
    request.deliveries.some((delivery) => delivery.status === 'failed'),
  ) &&
  !queue.tasks.some((task) => task.status === 'failed');

/** A job lane can be held by work outside the current transcript. Never retry a different head. */
export const queueRecoveryPlan = (
  queue: WorkQueueView | undefined,
  requests: readonly ChatRequest[],
  thread: string,
  conversations: readonly Pick<Conversation, 'id' | 'title'>[] = [],
): QueueRecoveryPlan | null => {
  const target = queueRecoveryRequest(queue?.requests ?? requests);
  if (!queueNeedsResume(queue) && !target) return null;
  const queueLink = (explanation: string): QueueRecoveryPlan => ({
    kind: 'queue',
    label: 'Open Queue',
    title: explanation,
    explanation,
    hold: 'review',
  });
  if (queue?.tasks.some((task) => task.status === 'failed'))
    return queueLink('A crew follow-up needs review in Queue before these messages can continue.');
  if (canResumeQueue(queue))
    return {
      kind: 'resume',
      path: `/queue/${encodeURIComponent(queue!.id)}`,
      hold: 'resume',
      label: queue!.cardId ? 'Resume queue' : 'Resume all',
      title: 'Continue messages that have not started. Stopped replies stay stopped.',
    };
  const head = queue?.requests[0] ?? target;
  if (head && head.threadId !== thread) {
    const conversation = conversations.find((item) => item.id === head.threadId);
    if (!conversation)
      return queueLink('Review the earlier work in this job’s Queue before continuing.');
    return {
      kind: 'chat',
      thread: head.threadId,
      label: 'Open blocking chat',
      hold: 'review',
      title: `Review the unfinished work in ${conversation.title}`,
      explanation: `This job’s queue is waiting on ${conversation.title}. Review its unfinished message first.`,
    };
  }
  const recovery = target && requestRecovery(target);
  if (target && recovery && requests.some((request) => request.id === target.id))
    return {
      kind: 'request',
      request: target,
      path: `/chat-requests/${target.id}`,
      label: recovery.retry ? 'Retry' : 'Resume message',
      hold: recovery.retry ? 'retry' : 'resume',
      title: `${recovery.description}${requests.some((request) => request.id !== target.id && requestRecovery(request)?.retry) ? ' Other attempted messages still need review.' : ''}`,
    };
  return queueLink('Review the waiting work in Queue before continuing.');
};
