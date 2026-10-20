import type { Card } from './cards.ts';
import type { ChatRequest } from './conversations.ts';
import type { AgentTask, Run } from './runs.ts';

export type BoardAction = 'fit' | 'draft' | 'review' | 'deep-review';
export const boardActionLabels: Record<BoardAction, string> = {
  fit: 'Evaluate fit',
  draft: 'Draft application',
  review: 'Review packet',
  'deep-review': 'Deep review resume',
};
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
export function workQueueId(cardId: string | null, threadId: string): string {
  return cardId ? `job:${cardId}` : `conversation:${threadId}`;
}
export function requestPending(request: ChatRequest): boolean {
  return request.deliveries.some((d) => !['completed', 'cancelled'].includes(d.status));
}
/** Compare prerequisites supplied by earlier actions, including future draft outputs. */
export function queueSequenceProblems(card: Card, requests: ChatRequest[]): Map<string, string> {
  let states = [card.state as string];
  let packet = !!card.packet;
  const problems = new Map<string, string>();
  for (const request of requests) {
    const action = request.boardAction;
    if (!action) continue;
    if (action === 'review' && !packet) problems.set(request.id, 'Review needs a draft first.');
    const allowed =
      action === 'fit'
        ? ['lead']
        : action === 'draft'
          ? ['shortlisted', 'changes_requested']
          : action === 'review'
            ? ['in_review', 'agreed', 'awaiting_approval']
            : ['shortlisted', 'changes_requested', 'in_review', 'agreed', 'awaiting_approval'];
    if (!states.some((state) => allowed.includes(state)) && !problems.has(request.id))
      problems.set(request.id, `${boardActionLabels[action]} needs an earlier workflow stage.`);
    if (action === 'draft') {
      packet = true;
      states = ['in_review'];
    }
    if (action === 'review' || action === 'deep-review') states = ['agreed', 'changes_requested'];
  }
  return problems;
}
