import { queueMayStart } from './queue/dispatch.ts';
import { QueueBusyError, launchProblem } from './queue/admission.ts';
import {
  ensureQueue,
  patchQueue,
  nextOrder,
  runLane,
  laneId,
  queueRequests,
  activeQueues,
} from './queue/state.ts';
import { requestProblem, requestIsHead } from './queue/requests.ts';
import { moveQueueRequest } from './queue/commands.ts';
import { RuntimeHeldError } from '../runtime-maintenance/availability.ts';
import { messageRecipients, resolveChatReferences } from './chat-references.ts';
import { chatReferenceInput } from '@pitchcrew/core';
import { failReviewContinuation } from './deep-reviews/state.ts';
import { startDeepReview } from './deep-reviews/index.ts';
import { isDeepReviewRequest, queueDeepReviewChat } from './deep-reviews/chat.ts';
import { questionContinuationAllowed } from './user-input/context.ts';
import { cancelUserQuestions, waitingOnUser } from './user-input/lifecycle.ts';
import { randomUUID } from 'node:crypto';
import {
  chatInput,
  type ChatRequest,
  type Run,
  type AgentTask,
  type ChatMessage,
  type Role,
} from '@pitchcrew/core';
import { z } from 'zod';
import { saveAttachments, removeAttachments } from './attachments/storage.ts';
import { conversation, conversations, canReadConversation } from './conversations.ts';
import type { CrewContext } from './types.ts';
export const saveRequest = (context: CrewContext, request: ChatRequest): void => {
  const queue = ensureQueue(context, request.threadId, request.rootRunId);
  if (
    !context.board.list<ChatRequest>('chat_request').some((r) => r.id === request.id) &&
    !queueRequests(context, queue.id).length &&
    !activeQueues(context).has(queue.id)
  )
    patchQueue(context, queue.id, { order: nextOrder(context) });
  context.board.record('chat_request', request, 'user', 'Updated queued message');
  context.publishChat(true);
};
export const sendConversation = async (
  context: CrewContext,
  id: string,
  data: unknown,
): Promise<ChatRequest> => {
  const item = conversation(context, id);
  if (item.kind === 'history' || item.kind === 'agent_dm')
    throw new Error('This conversation is read-only.');
  const input = chatInput.parse(data);
  const { intent } = z
    .object({ intent: z.enum(['queue', 'interrupt']).default('queue') })
    .parse(data);
  const references = resolveChatReferences(context, item, input.content, input.references);
  const targets = messageRecipients(input.content, item);
  if (!targets.length) throw new Error('Mention an agent participating in this conversation.');
  const eligible = targets.filter((id) => {
    const role = context.board.get<Role>('role', id);
    const config = { ...role, ...item.configurations[id] };
    return (
      role.enabled &&
      !role.retiredAt &&
      context.runtimes.some((runtime) => runtime.id === config.runtime && runtime.available)
    );
  });
  if (!eligible.length)
    throw new Error('No requested participant is enabled with an available runtime.');
  await Promise.all(
    eligible.map((roleId) => {
      const role = context.board.get<Role>('role', roleId);
      return context.runtimeMaintenance.refreshOnRetry({ ...role, ...item.configurations[roleId] });
    }),
  );
  const files = await saveAttachments(context.directory, input.attachments);
  try {
    if (JSON.stringify(conversation(context, id)) !== JSON.stringify(item))
      throw new Error('The conversation changed. Try sending again.');
    if (isDeepReviewRequest(input.content)) {
      const request = queueDeepReviewChat(context, item, input.content, files, references);
      void drainConversationQueue(context);
      return request;
    }
    if (intent === 'interrupt') {
      stopConversationWork(context, id);
      const queue = ensureQueue(context, id);
      patchQueue(context, queue.id, { paused: false, pauseKind: undefined, reason: '' });
      for (const pending of queueRequests(context, queue.id)) {
        for (const entry of pending.deliveries)
          if (entry.status === 'paused') entry.status = entry.runId ? 'cancelled' : 'queued';
        saveRequest(context, pending);
      }
    }
    const request: ChatRequest = {
      id: randomUUID(),
      threadId: id,
      messageId: randomUUID(),
      content: input.content,
      references,
      attachments: files,
      createdAt: new Date().toISOString(),
      order:
        intent === 'interrupt'
          ? Math.min(
              Date.now(),
              ...context.board.list<ChatRequest>('chat_request').map((entry) => entry.order),
            ) - 1
          : Math.max(
              Date.now(),
              ...context.board.list<ChatRequest>('chat_request').map((entry) => entry.order + 1),
            ),
      deliveries: eligible.map((roleId) => ({ roleId, status: 'queued', runId: null, error: '' })),
    };
    context.board.db.transaction(() => {
      context.addMessage(
        id,
        'user',
        item.kind === 'group' || item.kind === 'application' ? 'crew' : eligible[0]!,
        input.content,
        item.cardId,
        null,
        request.messageId,
        undefined,
        files,
        references,
      );
      saveRequest(context, request);
    })();
    void drainConversationQueue(context);
    return request;
  } catch (error) {
    await removeAttachments(context.directory, files);
    throw error;
  }
};
export const drainConversationQueue = async (context: CrewContext): Promise<void> => {
  if (context.closing || context.initializing || context.profileWriting) return;
  if (draining.has(context)) {
    drainAgain.add(context);
    return;
  }
  draining.add(context);
  try {
    for (const request of context.board
      .list<ChatRequest>('chat_request')
      .filter(
        (r) =>
          r.deliveries.some((d) => d.status === 'queued') &&
          conversations(context).some((c) => c.id === r.threadId),
      )
      .sort(
        (a, b) =>
          ensureQueue(context, a.threadId, a.rootRunId).order -
            ensureQueue(context, b.threadId, b.rootRunId).order || a.order - b.order,
      )) {
      if (context.closing) break;
      for (const queued of request.deliveries.filter((delivery) => delivery.status === 'queued')) {
        // Another turn may delete a later queued conversation while setup awaits.
        if (!conversations(context).some((item) => item.id === request.threadId)) continue;
        const current = context.board.get<ChatRequest>('chat_request', request.id);
        const delivery = current.deliveries.find((entry) => entry.roleId === queued.roleId)!;
        if (delivery.status !== 'queued') continue;
        const item = conversation(context, request.threadId);
        if (!current.deepReviewRequest && !item.participants.includes(delivery.roleId)) {
          delivery.status = 'cancelled';
          saveRequest(context, current);
          continue;
        }
        if (waitingOnUser(context, request.threadId, delivery.roleId)) continue;
        if (current.userInputId) {
          const question = context.board.get<import('@pitchcrew/core').UserInputRequest>(
            'user_input',
            current.userInputId,
          );
          const origin = context.board.get<Run>('run', question.runId);
          if (question.status !== 'answered' || !questionContinuationAllowed(context, origin)) {
            cancelUserQuestions(
              context,
              (q) => q.id === question.id,
              'The originating agent’s permissions changed.',
            );
            continue;
          }
        }
        const queue = ensureQueue(context, current.threadId, current.rootRunId);
        if (!requestIsHead(context, current)) continue;
        const problem = await requestProblem(context, current);
        if (problem) {
          patchQueue(context, queue.id, { reason: problem });
          continue;
        }
        const role = context.board.get<Role>('role', delivery.roleId);
        const configuration =
          current.boardAction || current.routine
            ? role
            : { ...role, ...item.configurations[role.id] };
        if (
          !role.enabled ||
          role.retiredAt ||
          !context.runtimes.some(
            (runtime) => runtime.id === configuration.runtime && runtime.available,
          ) ||
          context.configuring.has(role.id) ||
          context.runtimeMaintenance.held(configuration)
        )
          continue;
        if (
          launchProblem(context, {
            cardId: item.cardId,
            threadId: item.id,
            roleId: role.id,
            rootRunId: current.rootRunId ?? current.id,
          })
        )
          continue;
        if (!(await queueMayStart(context, queue.id, current.rootRunId ?? current.id))) continue;
        patchQueue(context, queue.id, { reason: '' });
        // Reserve delivery before setup awaits; another drain cannot duplicate it.
        delivery.status = 'running';
        saveRequest(context, current);
        try {
          const deepRequest =
            current.deepReviewRequest ??
            (current.boardAction === 'deep-review' ? { cardId: item.cardId! } : undefined);
          const savedReview = deepRequest?.resumeId
            ? context.board.get<import('@pitchcrew/core').DeepReview>(
                'deep_review',
                deepRequest.resumeId,
              )
            : undefined;
          const run = deepRequest
            ? await startDeepReview(
                context,
                deepRequest.cardId,
                savedReview?.options ?? current.deepReviewOptions ?? deepRequest.preferences ?? {},
                deepRequest.resumeId,
                { requestId: current.id, rootRunId: current.rootRunId ?? current.id },
                current.threadId,
              )
            : current.mode === 'workflow' || current.boardAction
              ? await context.startRun(
                  item.cardId!,
                  role.id,
                  undefined,
                  {
                    requestId: current.id,
                    rootRunId: current.rootRunId ?? current.id,
                    content: current.content,
                  },
                  current.boardAction === 'draft' ||
                    (current.userInputId
                      ? context.board.get<Run>(
                          'run',
                          context.board.get<import('@pitchcrew/core').UserInputRequest>(
                            'user_input',
                            current.userInputId,
                          ).runId,
                        ).purpose === 'application-draft'
                      : false),
                )
              : await context.startChatRun(
                  role.id,
                  current.content,
                  item.cardId,
                  item.id,
                  undefined,
                  current.routine,
                  undefined,
                  current.attachments,
                  { requestId: current.id, rootRunId: current.rootRunId ?? current.id },
                );
          const latest = context.board.get<ChatRequest>('chat_request', current.id);
          const entry = latest.deliveries.find((entry) => entry.roleId === role.id)!;
          entry.runId = run.id;
          if (current.routine) {
            const routine = context.board.get<import('@pitchcrew/core').Routine>(
              'routine',
              current.routine.routineId,
            );
            context.board.record(
              'routine',
              { ...routine, lastRunId: run.id },
              'system',
              'Started queued routine',
            );
          }
          if (entry.status === 'paused' || entry.status === 'cancelled')
            context.controllers.get(run.id)?.abort();
          saveRequest(context, latest);
        } catch (error) {
          if (context.closing) return;
          if (error instanceof RuntimeHeldError || error instanceof QueueBusyError) {
            const latest = context.board.get<ChatRequest>('chat_request', current.id);
            const entry = latest.deliveries.find((entry) => entry.roleId === role.id)!;
            if (entry.status === 'running') {
              entry.status = 'queued';
              entry.error = error.message;
              saveRequest(context, latest);
            }
            continue;
          }
          if (current.deepReviewRequest?.resumeId)
            failReviewContinuation(
              context,
              current.deepReviewRequest.resumeId,
              error instanceof Error ? error.message : 'Continuation failed.',
            );
          const latest = context.board.get<ChatRequest>('chat_request', current.id);
          const entry = latest.deliveries.find((entry) => entry.roleId === role.id)!;
          if (entry.status === 'running') {
            entry.status = 'failed';
            entry.error = error instanceof Error ? error.message : 'Could not start the turn.';
            patchQueue(context, queue.id, {
              paused: true,
              pauseKind: 'failed',
              reason: entry.error,
            });
            saveRequest(context, latest);
          }
        }
      }
    }
  } finally {
    draining.delete(context);
    if (drainAgain.has(context)) {
      drainAgain.delete(context);
      void drainConversationQueue(context);
    }
  }
};
export const finishDelivery = (context: CrewContext, run: Run): void => {
  finishQueueRun(context, run);
  if (!run.requestId) return;
  const request = context.board.get<ChatRequest>('chat_request', run.requestId);
  const delivery = request.deliveries.find((entry) => entry.roleId === run.roleId);
  const finished = context.board.get<Run>('run', run.id);
  if (delivery?.status === 'running') {
    delivery.status =
      finished.status === 'waiting'
        ? 'waiting'
        : finished.status === 'completed'
          ? 'completed'
          : finished.status === 'cancelled'
            ? 'paused'
            : 'failed';
    delivery.error = finished.status === 'failed' ? finished.message : '';
    saveRequest(context, request);
  }
};
const stopConversationBranch = (
  context: CrewContext,
  id: string,
  roleId?: string,
  rootId?: string,
): void => {
  const runs = context.board.list<Run>('run');
  const tasks = context.board.list<AgentTask>('task');
  const roots = new Set(
    rootId
      ? [rootId]
      : runs.filter((run) => run.threadId === id).map((run) => run.rootRunId ?? run.id),
  );
  const owned = runs.filter(
    (run) => roots.has(run.rootRunId ?? run.id) && (!roleId || run.roleId === roleId),
  );
  const branches = new Set(owned.map((run) => run.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks)
      if (branches.has(task.parentRunId) && task.runId && !branches.has(task.runId)) {
        branches.add(task.runId);
        changed = true;
      }
  }
  cancelUserQuestions(
    context,
    (q) =>
      roleId
        ? branches.has(q.runId) ||
          ((q.threadId === id || q.sourceThreadId === id) && q.roleId === roleId)
        : roots.has(runs.find((run) => run.id === q.runId)?.rootRunId ?? q.runId) ||
          q.threadId === id ||
          q.sourceThreadId === id,
    'Question cancelled because this work was stopped.',
  );
  for (const run of runs)
    if (
      run.status === 'running' &&
      (roleId ? branches.has(run.id) : roots.has(run.rootRunId ?? run.id))
    ) {
      context.controllers.get(run.id)?.abort();
      context.streamingMessages.delete(run.id);
    }
  for (const task of tasks)
    if (
      task.status === 'queued' &&
      (roleId
        ? branches.has(task.parentRunId) || (roots.has(task.rootRunId) && task.roleId === roleId)
        : roots.has(task.rootRunId))
    )
      context.board.record(
        'task',
        { ...task, status: 'cancelled', error: 'Stopped by the user.' },
        'user',
        'Cancelled delegated work',
      );
  for (const request of context.board
    .list<ChatRequest>('chat_request')
    .filter((request) => request.threadId === id && (!rootId || request.id === rootId))) {
    let changed = false;
    for (const delivery of request.deliveries)
      if (
        (!roleId || delivery.roleId === roleId) &&
        ['queued', 'running'].includes(delivery.status)
      ) {
        delivery.status = 'paused';
        changed = true;
      }
    if (changed) saveRequest(context, request);
  }
  context.publishChat(true);
};
export const stopConversationWork = (
  context: CrewContext,
  id: string,
  roleId?: string,
  rootId?: string,
): void => {
  if (roleId) return stopConversationBranch(context, id, roleId, rootId);
  const queue = ensureQueue(context, id);
  patchQueue(context, queue.id, { paused: true, pauseKind: 'user', reason: 'Paused by you.' });
  const runs = context.board.list<Run>('run');
  const owned = runs.filter(
    (run) =>
      (queue.cardId ? run.cardId === queue.cardId : run.threadId === id) &&
      (!rootId || (run.rootRunId ?? run.id) === rootId),
  );
  const roots = new Set(owned.map((run) => run.rootRunId ?? run.id));
  cancelUserQuestions(
    context,
    (q) => roots.has(runs.find((run) => run.id === q.runId)?.rootRunId ?? q.runId),
    'Stopped by you.',
  );
  for (const run of runs)
    if (roots.has(run.rootRunId ?? run.id)) {
      context.controllers.get(run.id)?.abort();
      context.streamingMessages.delete(run.id);
    }
  for (const task of context.board.list<AgentTask>('task'))
    if (roots.has(task.rootRunId) && task.status === 'queued')
      context.board.record(
        'task',
        { ...task, status: 'cancelled', error: 'Stopped by you.' },
        'user',
        'Cancelled crew follow-up',
      );
  for (const request of queueRequests(context, queue.id)) {
    for (const entry of request.deliveries) {
      if (entry.status === 'running') entry.status = 'paused';
      else if (entry.status === 'queued') entry.status = 'paused';
    }
    saveRequest(context, request);
  }
  context.publishChat(true);
};
export const finishQueueRun = (context: CrewContext, run: Run): void => {
  const finished = context.board.get<Run>('run', run.id);
  const thread = run.threadId;
  if (
    !thread ||
    !context.board
      .list<import('@pitchcrew/core').Conversation>('conversation')
      .some((c) => c.id === thread)
  )
    return;
  const scope = runLane(context, run);
  if (['waiting', 'failed', 'cancelled'].includes(finished.status))
    context.queueChains.delete(scope);
  if (scope.startsWith('routine:')) return;
  const queue = ensureQueue(context, thread, run.rootRunId);
  if (finished.status === 'failed')
    patchQueue(context, queue.id, { paused: true, pauseKind: 'failed', reason: finished.message });
  else if (!activeQueues(context).has(queue.id))
    patchQueue(context, queue.id, { order: nextOrder(context) });
};
export const updateRequest = (context: CrewContext, id: string, data: unknown): ChatRequest => {
  const input = z
    .object({
      action: z.enum(['edit', 'remove', 'next', 'resume', 'up', 'down', 'interrupt']),
      content: z.string().trim().max(8000).optional(),
      references: z.array(chatReferenceInput).max(32).optional(),
    })
    .parse(data);
  if (['up', 'down', 'next'].includes(input.action)) {
    const request = context.board.get<ChatRequest>('chat_request', id);
    const entries = queueRequests(context, laneId(context, request.threadId, request.rootRunId));
    const index = entries.findIndex((r) => r.id === id);
    const before =
      input.action === 'next'
        ? (entries.find((r) => r.id !== id && !r.deliveries.some((d) => d.status === 'running'))
            ?.id ?? null)
        : input.action === 'up'
          ? (entries[index - 1]?.id ?? entries[index + 1]?.id ?? null)
          : (entries[index + 2]?.id ?? null);
    return moveQueueRequest(context, id, before);
  }
  const request = context.board.get<ChatRequest>('chat_request', id);
  const pending = request.deliveries.filter((delivery) =>
    ['queued', 'paused', 'failed'].includes(delivery.status),
  );
  if (!pending.length && input.action !== 'remove')
    throw new Error('This request has no pending deliveries.');
  if (input.action === 'edit') {
    if (request.userInputId)
      throw new Error('Your answer is already saved. Send a correction instead.');
    if (
      request.deliveries.some(
        (delivery) => delivery.runId || !['queued', 'paused', 'failed'].includes(delivery.status),
      )
    )
      throw new Error('This message has started. Send a correction instead.');
    if (input.content === undefined || (!input.content && !request.attachments.length))
      throw new Error('Write a message or attach a file.');
    const item = conversation(context, request.threadId);
    const references = resolveChatReferences(context, item, input.content, input.references);
    const targets = messageRecipients(input.content, item);
    if (!targets.length) throw new Error('Mention an agent participating in this conversation.');
    const paused = request.deliveries.some((delivery) =>
      ['paused', 'failed'].includes(delivery.status),
    );
    request.deliveries = targets.map((roleId) => ({
      roleId,
      status: paused ? 'paused' : 'queued',
      runId: null,
      error: '',
    }));
    request.content = input.content;
    request.references = references;
    const message = context.board.get<ChatMessage>('message', request.messageId);
    context.board.record(
      'message',
      { ...message, content: input.content, references },
      'user',
      'Edited queued message',
    );
  }
  if (input.action === 'remove')
    for (const delivery of request.deliveries)
      if (['queued', 'paused', 'failed'].includes(delivery.status)) delivery.status = 'cancelled';
  if (input.action === 'interrupt') {
    stopConversationWork(context, request.threadId);
    for (const saved of queueRequests(
      context,
      laneId(context, request.threadId, request.rootRunId),
    )) {
      if (saved.id === request.id) continue;
      for (const entry of saved.deliveries)
        if (entry.status === 'paused') entry.status = entry.runId ? 'cancelled' : 'queued';
      saveRequest(context, saved);
    }
    request.order =
      Math.min(
        Date.now(),
        ...context.board.list<ChatRequest>('chat_request').map((entry) => entry.order),
      ) - 1;
  }
  if (input.action === 'resume' || input.action === 'interrupt')
    for (const delivery of request.deliveries)
      if (
        ['paused', 'failed'].includes(delivery.status) &&
        canReadConversation(context, delivery.roleId, request.threadId)
      )
        delivery.status = 'queued';
  if (input.action === 'resume' || input.action === 'interrupt') {
    patchQueue(context, laneId(context, request.threadId, request.rootRunId), {
      paused: false,
      pauseKind: undefined,
      reason: '',
      order: nextOrder(context),
    });
    for (const delivery of request.deliveries)
      if (delivery.status === 'queued') {
        delivery.error = '';
        delivery.runId = null;
      }
  }
  saveRequest(context, request);
  if (input.action === 'remove')
    cancelUserQuestions(
      context,
      (q) =>
        q.continuationRequestId === request.id ||
        context.board.get<Run>('run', q.runId).requestId === request.id,
      'The queued task was removed by the user.',
    );
  void drainConversationQueue(context);
  return context.board.get<ChatRequest>('chat_request', id);
};

const draining = new WeakSet<CrewContext>();
const drainAgain = new WeakSet<CrewContext>();
