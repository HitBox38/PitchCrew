import { assertReviewedContext, digestPacket } from '@pitchcrew/board';
import type { Approval } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertConfirmedContext, assertExtractedContext } from '@pitchcrew/board';
import { readProfile } from '@pitchcrew/packet';
import { assertProfileReady } from '../../profile-sources/mutation.ts';
import {
  deepReviewOptionsSchema,
  boardActionLabels,
  workflowSeat,
  type Card,
  type ChatRequest,
  type Conversation,
  type Role,
} from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { assertApplicationRuntime } from '../application-context/extraction.ts';
import { relatedConversation } from '../conversations.ts';
import { drainConversationQueue, saveRequest } from '../conversation-queue.ts';
import { ensureQueue, laneId, queueRequests, queueWaiting } from './state.ts';
export const queueBoardAction = (context: CrewContext, data: unknown): ChatRequest => {
  const input = queueBoardInput.parse(data);
  const card = context.board.get<Card>('card', input.cardId);
  const seat = ['fit', 'reevaluate'].includes(input.action)
    ? 'scout'
    : input.action === 'draft'
      ? 'writer'
      : 'reviewer';
  const role = context.board
    .list<Role>('role')
    .find(
      (r) =>
        !r.retiredAt &&
        r.enabled &&
        (workflowSeat(r) === seat || (input.action === 'draft' && r.id === input.roleId)) &&
        (!input.roleId || r.id === input.roleId),
    );
  if (!role) throw new Error(`Enable an agent in the ${seat} seat in Crew.`);
  const thread = relatedConversation(
    context,
    'application',
    card.id,
    role.id,
    card.id,
    `${card.company}: Application work`,
  );
  const queue = ensureQueue(context, thread.id);
  const existing = queueRequests(context, queue.id).find((r) => r.boardAction === input.action);
  if (existing && !input.repeat) return existing;
  const request: ChatRequest = {
    id: randomUUID(),
    threadId: thread.id,
    messageId: randomUUID(),
    content: boardActionLabels[input.action],
    attachments: [],
    boardAction: input.action,
    deepReviewOptions: input.deepReviewOptions,
    mode: 'workflow',
    createdAt: new Date().toISOString(),
    order: Math.max(
      Date.now(),
      ...context.board.list<ChatRequest>('chat_request').map((r) => r.order + 1),
    ),
    deliveries: [{ roleId: role.id, status: 'queued', runId: null, error: '' }],
  };
  context.board.db.transaction(() => {
    context.addMessage(
      thread.id,
      'user',
      role.id,
      request.content,
      card.id,
      null,
      request.messageId,
    );
    saveRequest(context, request);
  })();
  void drainConversationQueue(context);
  return request;
};
export const requestProblem = async (
  context: CrewContext,
  request: ChatRequest,
): Promise<string> => {
  const thread = context.board
    .list<Conversation>('conversation')
    .find((c) => c.id === request.threadId);
  if (!thread) return 'This conversation was deleted.';
  const queue = ensureQueue(context, thread.id, request.rootRunId);
  if (queue.paused) return queue.reason || 'Queue paused.';
  if (queueWaiting(context, queue.id)) return 'Waiting for your answer.';
  for (const delivery of request.deliveries.filter((d) => d.status === 'queued')) {
    const role = context.board.list<Role>('role').find((r) => r.id === delivery.roleId);
    if (!role || role.retiredAt || !role.enabled) return 'Enable the assigned agent in Crew.';
    const config =
      request.boardAction || request.routine
        ? role
        : { ...role, ...thread.configurations[role.id] };
    if (!context.runtimes.some((r) => r.id === config.runtime && r.available))
      return 'Install the assigned runtime in Settings.';
    if (request.boardAction) {
      try {
        assertApplicationRuntime(role);
      } catch (error) {
        return error instanceof Error ? error.message : 'Choose an isolated application runtime.';
      }
    }
    if (context.configuring.has(role.id)) return 'Agent settings are being updated.';
    if (context.runtimeMaintenance.held(config))
      return 'Waiting for runtime authentication or maintenance.';
  }
  if (request.submissionApprovalId) {
    try {
      const approval = context.board.get<Approval>('approval', request.submissionApprovalId);
      const card = context.board.get<Card>('card', approval.cardId);
      if (
        approval.status !== 'consumed' ||
        !approval.exportDirectory ||
        !card.packet ||
        card.state !== 'awaiting_approval' ||
        digestPacket(card.id, card.packet) !== approval.digest ||
        assertReviewedContext(card).revision !== approval.contextRevision
      )
        return 'The packet changed. Review and approve the current application.';
      if (card.submissionAttempts?.some((attempt) => attempt.status === 'uncertain'))
        return 'Verify the previous submission outcome first.';
      const role = context.board.get<Role>('role', request.deliveries[0]!.roleId);
      if (
        !role.capabilities?.computerUse ||
        !role.capabilities?.assessForms ||
        !role.capabilities?.recordSubmissions
      )
        return 'Restore this agent’s browser, form assessment and receipt tools in Crew.';
    } catch (error) {
      return error instanceof Error ? error.message : 'The submission context is unavailable.';
    }
  }
  if (!request.boardAction) return '';
  const card = context.board.list<Card>('card').find((c) => c.id === thread.cardId);
  if (!card) return 'This job was deleted.';
  const action = request.boardAction;
  if (action === 'reevaluate' && !card.packet) return 'Draft a packet before reevaluating.';
  if (action === 'fit' && card.state !== 'lead') return 'Evaluate fit needs a job in New leads.';
  if (action === 'draft' && !['shortlisted', 'changes_requested'].includes(card.state))
    return 'Shortlist this job or request changes before drafting.';
  if (action === 'review' && !card.packet) return 'Needs a draft before review.';
  if (action === 'review' && !['in_review', 'agreed', 'awaiting_approval'].includes(card.state))
    return 'Draft this application before reviewing.';
  if (
    action === 'deep-review' &&
    !['shortlisted', 'changes_requested', 'in_review', 'agreed', 'awaiting_approval'].includes(
      card.state,
    )
  )
    return 'Shortlist this job before deep review.';
  try {
    if (action === 'fit' || action === 'reevaluate') assertExtractedContext(card);
    else assertConfirmedContext(card);
  } catch (error) {
    return error instanceof Error ? error.message : 'Confirm the job brief.';
  }
  if (context.profileWriting) return 'Wait for the Profile update to finish.';
  try {
    assertProfileReady(context);
    if (!(await readProfile(context.directory)).length)
      return 'Add your Profile notes before starting the crew.';
  } catch (error) {
    return error instanceof Error ? error.message : 'Check your Profile notes.';
  }
  return '';
};
export const requestIsHead = (context: CrewContext, request: ChatRequest): boolean => {
  const entries = queueRequests(context, laneId(context, request.threadId, request.rootRunId));
  return entries[0]?.id === request.id;
};

export const queueBoardInput = z.object({
  cardId: z.uuid(),
  action: z.enum(['fit', 'draft', 'review', 'deep-review', 'reevaluate']),
  roleId: z.string().optional(),
  repeat: z.boolean().default(false),
  deepReviewOptions: deepReviewOptionsSchema.optional(),
});
