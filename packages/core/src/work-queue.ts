import { boardActionLabels, type BoardAction } from './board-action-labels.ts';
import type { Card } from './cards.ts';
import type { ChatRequest } from './conversations.ts';
import { cardLifecycle } from './lifecycles.ts';
import type { AgentTask, Run } from './runs.ts';
export const workQueueId = (cardId: string | null, threadId: string): string => {
  return cardId ? `job:${cardId}` : `conversation:${threadId}`;
};
export const requestPending = (request: ChatRequest): boolean => {
  return request.deliveries.some((d) => !['completed', 'cancelled'].includes(d.status));
};
/** Compare prerequisites supplied by earlier actions, including future draft outputs. */
export const queueSequenceProblems = (
  card: Pick<Card, 'state' | 'packet'>,
  requests: readonly Pick<ChatRequest, 'id' | 'boardAction'>[],
): Map<string, string> => {
  let states = [card.state];
  let packet = !!card.packet;
  const problems = new Map<string, string>();
  for (const request of requests) {
    const action = request.boardAction;
    if (!action) continue;
    if (action === 'reevaluate') {
      if (!packet) problems.set(request.id, 'Reevaluation needs a packet first.');
      continue;
    }
    if (action === 'review' && !packet) problems.set(request.id, 'Review needs a draft first.');
    const allowed: readonly Card['state'][] =
      action === 'fit'
        ? ['lead']
        : action === 'draft'
          ? cardLifecycle.groups.draftable
          : action === 'review'
            ? cardLifecycle.groups.reviewable
            : cardLifecycle.groups.deepReviewable;
    if (!states.some((state) => allowed.includes(state)) && !problems.has(request.id))
      problems.set(request.id, `${boardActionLabels[action]} needs an earlier workflow stage.`);
    if (action === 'draft') {
      packet = true;
      states = ['in_review'];
    }
    if (action === 'review' || action === 'deep-review') states = ['agreed', 'changes_requested'];
  }
  return problems;
};

export { boardActionLabels, type BoardAction };
export interface WorkQueue {
  id: string;
  cardId: string | null;
  threadId: string;
  order: number;
  paused: boolean;
  pauseKind?: 'user' | 'failed' | 'interrupted';
  reason: string;
  updatedAt: string;
}
export interface QueueSettings {
  id: 'workspace';
  concurrency: number;
}
export interface WorkQueueView extends WorkQueue {
  title: string;
  state: 'running' | 'waiting' | 'paused' | 'blocked' | 'ready';
  requests: ChatRequest[];
  runs: Run[];
  tasks: AgentTask[];
}
export interface WorkspaceQueue {
  concurrency: number;
  active: number;
  background: number;
  queues: WorkQueueView[];
}
