import { reviewPerspectives, type ReviewPerspective } from '@pitchcrew/core/deep-review-labels';
import { randomUUID } from 'node:crypto';
import {
  workflowSeat,
  type Card,
  type ChatMessage,
  type ChatRequest,
  type Conversation,
  type Role,
  type Run,
  type UserInputRequest,
} from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { askUser } from '../user-input/questions.ts';
import { endQuestionTurn } from '../user-input/lifecycle.ts';

export function isDeepReviewRequest(content: string) {
  return /^\s*(?:@[a-z][a-z0-9-]*\s+)*(?:\/hiring-panel\b|(?:please\s+)?(?:(?:run|start|do|perform)\s+)?(?:a\s+)?(?:deep\s+(?:resume\s+review|review\s+(?:(?:my|the|this)\s+)?resume)|hiring[- ]panel)\b)/i.test(
    content,
  );
}
export function queueDeepReviewChat(
  context: CrewContext,
  item: Conversation,
  content: string,
  attachments: ChatMessage['attachments'] = [],
  references: ChatMessage['references'] = [],
): ChatRequest {
  const reviewer = context.board
    .list<Role>('role')
    .find((role) => role.enabled && !role.retiredAt && workflowSeat(role) === 'reviewer');
  if (!reviewer) throw new Error('Enable a Reviewer in Crew before requesting deep review.');
  const roleId = item.cardId
    ? reviewer.id
    : (item.participants.find((id) => context.board.get<Role>('role', id).enabled) ??
      item.participants[0]!);
  const firstLine = content.split('\n')[0]!.slice(0, 500).toLowerCase();
  const secondOpinions =
    /\b(?:subagents?|sub-agents?|second opinions?|multiple reviewers?|extra reviewers?)\b/.test(
      firstLine,
    );
  const requestedPerspectives = secondOpinions
    ? (Object.keys(reviewPerspectives) as ReviewPerspective[]).filter((key) =>
        new RegExp(`\\b${key}\\b`, 'i').test(firstLine),
      )
    : [];
  const preferences = { secondOpinions, requestedPerspectives };
  const request: ChatRequest = {
    deepReviewPreferences: preferences,
    id: randomUUID(),
    threadId: item.id,
    messageId: randomUUID(),
    content,
    references,
    attachments: attachments ?? [],
    createdAt: new Date().toISOString(),
    order: Date.now(),
    deliveries: [{ roleId, status: item.cardId ? 'queued' : 'waiting', runId: null, error: '' }],
    mode: 'workflow',
    ...(item.cardId ? { deepReviewRequest: { cardId: item.cardId, preferences } } : {}),
  };
  context.addMessage(
    item.id,
    'user',
    roleId,
    content,
    item.cardId,
    null,
    request.messageId,
    undefined,
    attachments,
    references,
  );
  if (!item.cardId) {
    const role = context.board.get<Role>('role', roleId);
    const run: Run = {
      id: randomUUID(),
      roleId,
      runtime: role.runtime,
      cardId: null,
      threadId: item.id,
      requestId: request.id,
      deepReviewSelection: true,
      mode: 'chat',
      status: 'running',
      message: 'Choose a job for deep resume review',
      startedAt: request.createdAt,
      finishedAt: null,
    };
    context.board.record('run', run, roleId, run.message);
    request.deliveries[0]!.runId = run.id;
    context.board.record('chat_request', request, 'user', 'Asked which job to deep review');
    const cards = context.board
      .list<Card>('card')
      .filter((card) =>
        ['shortlisted', 'changes_requested', 'in_review', 'agreed', 'awaiting_approval'].includes(
          card.state,
        ),
      )
      .slice(-20)
      .reverse();
    askUser(
      context,
      { runId: run.id, roleId, cardId: null },
      {
        question: 'Which job should I use for the deep resume review?',
        reason:
          'The review needs a specific job and its confirmed brief. Choose a shortlisted job, or enter its exact job ID.',
        options: cards.map((card) => ({
          id: card.id,
          label: `${card.company}: ${card.title}`.slice(0, 200),
        })),
        continuationNotes: 'Start the managed deep resume review for the selected job.',
      },
    );
    endQuestionTurn(context, run);
  } else
    context.board.record('chat_request', request, 'user', 'Queued deep resume review from chat');
  context.publishChat(true);
  return request;
}
export function deepReviewQuestionRequest(
  context: CrewContext,
  origin: Run,
  question: UserInputRequest,
  selected: string[],
  text: string,
) {
  if (!origin.deepReviewId && !origin.deepReviewSelection) return undefined;
  const report = origin.deepReviewId
    ? context.board.get<import('@pitchcrew/core').DeepReview>('deep_review', origin.deepReviewId)
    : undefined;
  let cardId = report?.cardId;
  if (!cardId) {
    const choice = selected[0] ?? text.trim();
    const matches = context.board
      .list<Card>('card')
      .filter(
        (card) =>
          card.id === choice ||
          `${card.company}: ${card.title}`.toLowerCase() === choice.toLowerCase(),
      );
    if (matches.length !== 1)
      throw new Error('Choose one job from the question or enter its exact ID.');
    cardId = matches[0]!.id;
  }
  const reviewerId =
    report?.reviewerId ??
    context.board
      .list<Role>('role')
      .find((role) => role.enabled && !role.retiredAt && workflowSeat(role) === 'reviewer')?.id;
  if (!reviewerId) throw new Error('Enable a Reviewer before continuing deep review.');
  return {
    cardId,
    resumeId: report?.id,
    reviewerId,
    sourceThreadId: question.sourceThreadId,
    preferences: report
      ? {
          secondOpinions: report.options.secondOpinions,
          requestedPerspectives: report.options.requestedPerspectives,
        }
      : origin.requestId
        ? context.board.get<ChatRequest>('chat_request', origin.requestId).deepReviewPreferences
        : undefined,
  };
}
