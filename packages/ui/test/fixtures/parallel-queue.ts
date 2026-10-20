import { randomUUID } from 'node:crypto';
import type { ChatMessage, ChatRequest, Run, WorkQueue, UserInputRequest } from '@pitchcrew/core';
import type { CrewService } from '../../../orchestrator/src/service.ts';

/** Fixed public queue state; no runtime or provider is launched. */
export const seedParallelQueue = (service: CrewService) => {
  const board = service.board;
  const now = new Date().toISOString();
  board.record('queue_settings', { id: 'workspace', concurrency: 5 }, 'user', 'Fixture capacity');
  const makeQueue = (title: string, job = false, paused = false) => {
    const card = job ? service.createCard({ company: title, title: 'Product Engineer' }) : null;
    const thread = service.createConversation({
      title,
      participants: ['scout', 'writer', 'reviewer'],
      cardId: card?.id ?? null,
    });
    const queue: WorkQueue = {
      id: card ? `job:${card.id}` : `conversation:${thread.id}`,
      cardId: card?.id ?? null,
      threadId: thread.id,
      order: Date.now(),
      paused,
      ...(paused ? { pauseKind: 'user' as const } : {}),
      reason: paused ? 'Paused by you.' : '',
      updatedAt: now,
    };
    board.record('work_queue', queue, 'system', 'Fixture queue');
    return queue;
  };
  const makeRun = (queue: WorkQueue, roleId: string, message: string, extra: Partial<Run> = {}) => {
    const run: Run = {
      id: randomUUID(),
      cardId: queue.cardId,
      threadId: queue.threadId,
      roleId,
      runtime: 'demo',
      status: 'running',
      mode: 'chat',
      message,
      startedAt: now,
      finishedAt: null,
      activity: [
        {
          id: randomUUID(),
          kind: 'tool',
          label: message,
          status: 'running',
          startedAt: now,
          finishedAt: null,
        },
      ],
      ...extra,
    };
    board.record('run', run, roleId, message);
    return run;
  };
  const addRequest = (queue: WorkQueue, roleId: string, content: string) => {
    const request: ChatRequest = {
      id: randomUUID(),
      messageId: randomUUID(),
      threadId: queue.threadId,
      content,
      attachments: [],
      createdAt: now,
      order: Date.now(),
      deliveries: [{ roleId, status: 'queued', runId: null, error: '' }],
    };
    const message: ChatMessage = {
      id: request.messageId,
      threadId: queue.threadId,
      from: 'user',
      to: roleId,
      cardId: queue.cardId,
      runId: null,
      content,
      createdAt: now,
    };
    board.record('message', message, 'user', 'Fixture message');
    board.record('chat_request', request, 'user', 'Fixture request');
    return request;
  };
  const first = makeQueue('Northstar Labs', true);
  const scout = makeRun(first, 'scout', 'Checking the team and role requirements');
  makeRun(first, 'writer', 'Matching your experience to the role', { rootRunId: scout.id });
  makeRun(first, 'reviewer', 'Reserved review seat', {
    rootRunId: scout.id,
    reviewSeatReservation: true,
  });
  addRequest(first, 'reviewer', 'Review the finished application');
  const second = makeQueue('Interview preparation');
  makeRun(second, 'scout', 'Researching the interview panel');
  const third = makeQueue('Juniper Studio', true);
  makeRun(third, 'writer', 'Drafting a focused cover letter');
  makeRun(third, 'reviewer', 'Checking the resume against the job brief');
  // A background occurrence occupies one slot without appearing as a job queue.
  makeRun(second, 'tracker', 'Checking application reminders', { routineId: randomUUID() });
  const next = makeQueue('Maple Systems', true);
  addRequest(next, 'scout', 'Evaluate this opportunity');
  const paused = makeQueue('Offer comparison', false, true);
  addRequest(paused, 'writer', 'Compare the two offers');
  const addWaitingQuestion = () => {
    const queue = makeQueue('Willow Robotics', true);
    const target = service.createConversation({
      title: 'Location question',
      participants: ['scout'],
      cardId: queue.cardId,
    });
    const request = addRequest(queue, 'scout', 'Confirm the role location');
    const question: UserInputRequest = {
      id: randomUUID(),
      threadId: target.id,
      sourceThreadId: queue.threadId,
      roleId: 'scout',
      runId: randomUUID(),
      messageId: randomUUID(),
      cardId: queue.cardId,
      question: 'Which location would you prefer?',
      reason: '',
      continuationNotes: '',
      options: [],
      multiSelect: false,
      createdAt: now,
      status: 'pending',
    };
    board.record(
      'chat_request',
      {
        ...request,
        deliveries: [{ roleId: 'scout', status: 'waiting', runId: question.runId, error: '' }],
      },
      'system',
      'Fixture waiting request',
    );
    board.record('user_input', question, 'scout', 'Fixture forwarded question');
    return target.id;
  };
  return { first, scout, next, paused, addWaitingQuestion };
};
