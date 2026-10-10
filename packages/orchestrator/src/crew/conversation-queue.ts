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
import { conversation, canReadConversation } from './conversations.ts';
import type { CrewContext } from './types.ts';
import { routineReadyBefore } from './routines/ready.ts';

const draining = new WeakSet<CrewContext>();
export function saveRequest(context: CrewContext, request: ChatRequest): void {
  context.board.record('chat_request', request, 'user', 'Updated queued message');
  context.publishChat(true);
}
export async function sendConversation(
  context: CrewContext,
  id: string,
  data: unknown,
): Promise<ChatRequest> {
  const item = conversation(context, id);
  if (item.kind === 'history' || item.kind === 'agent_dm')
    throw new Error('This conversation is read-only.');
  const input = chatInput.parse(data);
  const { intent } = z
    .object({ intent: z.enum(['queue', 'interrupt']).default('queue') })
    .parse(data);
  const mentions = [...input.content.matchAll(/(?:^|\s)@([a-z][a-z0-9-]*)\b/g)].map(
    (match) => match[1]!,
  );
  const targets = mentions.length
    ? item.participants.filter((roleId) => mentions.includes(roleId))
    : item.participants;
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
  const files = await saveAttachments(context.directory, input.attachments);
  try {
    if (JSON.stringify(conversation(context, id)) !== JSON.stringify(item))
      throw new Error('The conversation changed. Try sending again.');
    if (intent === 'interrupt') {
      for (const run of context.board
        .list<Run>('run')
        .filter((run) => run.status === 'running' && eligible.includes(run.roleId)))
        stopConversationWork(
          context,
          run.threadId ?? run.roleId,
          run.roleId,
          run.rootRunId ?? run.id,
        );
    }
    const request: ChatRequest = {
      id: randomUUID(),
      threadId: id,
      messageId: randomUUID(),
      content: input.content,
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
      );
      saveRequest(context, request);
    })();
    void drainConversationQueue(context);
    return request;
  } catch (error) {
    await removeAttachments(context.directory, files);
    throw error;
  }
}
export async function drainConversationQueue(context: CrewContext): Promise<void> {
  if (context.closing || context.initializing || draining.has(context) || context.profileWriting)
    return;
  draining.add(context);
  try {
    for (const request of context.board
      .list<ChatRequest>('chat_request')
      .sort((a, b) => a.order - b.order)) {
      if (context.closing) break;
      for (const queued of request.deliveries.filter((delivery) => delivery.status === 'queued')) {
        const current = context.board.get<ChatRequest>('chat_request', request.id);
        const delivery = current.deliveries.find((entry) => entry.roleId === queued.roleId)!;
        if (delivery.status !== 'queued') continue;
        const item = conversation(context, request.threadId);
        if (!item.participants.includes(delivery.roleId)) {
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
        const role = context.board.get<Role>('role', delivery.roleId);
        const configuration = { ...role, ...item.configurations[role.id] };
        if (
          !role.enabled ||
          role.retiredAt ||
          !context.runtimes.some(
            (runtime) => runtime.id === configuration.runtime && runtime.available,
          ) ||
          context.configuring.has(role.id)
        )
          continue;
        if (
          context.board
            .list<Run>('run')
            .some((run) => run.roleId === role.id && run.status === 'running')
        )
          continue;
        const olderTask = context.board
          .list<AgentTask>('task')
          .some(
            (task) =>
              task.roleId === role.id &&
              task.status === 'queued' &&
              Date.parse(task.createdAt) < current.order &&
              context.board.get<Run>('run', task.parentRunId).status === 'completed',
          );
        if (
          !current.userInputId &&
          (olderTask || routineReadyBefore(context, role.id, current.order))
        )
          continue;
        // Reserve delivery before setup awaits; another drain cannot duplicate it.
        delivery.status = 'running';
        saveRequest(context, current);
        try {
          const run =
            current.mode === 'workflow'
              ? await context.startRun(item.cardId!, role.id, undefined, {
                  requestId: current.id,
                  rootRunId: current.rootRunId ?? current.id,
                  content: current.content,
                })
              : await context.startChatRun(
                  role.id,
                  current.content,
                  item.cardId,
                  item.id,
                  undefined,
                  undefined,
                  undefined,
                  current.attachments,
                  { requestId: current.id, rootRunId: current.rootRunId ?? current.id },
                );
          const latest = context.board.get<ChatRequest>('chat_request', current.id);
          const entry = latest.deliveries.find((entry) => entry.roleId === role.id)!;
          entry.runId = run.id;
          if (entry.status === 'paused' || entry.status === 'cancelled')
            context.controllers.get(run.id)?.abort();
          saveRequest(context, latest);
        } catch (error) {
          const latest = context.board.get<ChatRequest>('chat_request', current.id);
          const entry = latest.deliveries.find((entry) => entry.roleId === role.id)!;
          if (entry.status === 'running') {
            entry.status = 'failed';
            entry.error = error instanceof Error ? error.message : 'Could not start the turn.';
            saveRequest(context, latest);
          }
        }
      }
    }
  } finally {
    draining.delete(context);
  }
}
export function finishDelivery(context: CrewContext, run: Run): void {
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
}
export function stopConversationWork(
  context: CrewContext,
  id: string,
  roleId?: string,
  rootId?: string,
): void {
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
}
export function updateRequest(context: CrewContext, id: string, data: unknown): ChatRequest {
  const input = z
    .object({
      action: z.enum(['edit', 'remove', 'next', 'resume', 'up', 'down', 'interrupt']),
      content: z.string().trim().max(8000).optional(),
    })
    .parse(data);
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
        (delivery) =>
          delivery.runId || (delivery.status !== 'queued' && delivery.status !== 'paused'),
      )
    )
      throw new Error('This message has started. Send a correction instead.');
    if (input.content === undefined || (!input.content && !request.attachments.length))
      throw new Error('Write a message or attach a file.');
    request.content = input.content;
    const message = context.board.get<ChatMessage>('message', request.messageId);
    context.board.record(
      'message',
      { ...message, content: input.content },
      'user',
      'Edited queued message',
    );
  }
  if (input.action === 'remove')
    for (const delivery of request.deliveries)
      if (['queued', 'paused', 'failed'].includes(delivery.status)) delivery.status = 'cancelled';
  if (input.action === 'next')
    request.order =
      Math.min(
        Date.now(),
        ...context.board.list<ChatRequest>('chat_request').map((entry) => entry.order),
      ) - 1;
  if (input.action === 'up' || input.action === 'down') {
    const queue = context.board
      .list<ChatRequest>('chat_request')
      .filter(
        (entry) =>
          entry.threadId === request.threadId &&
          entry.deliveries.some((delivery) =>
            ['queued', 'paused', 'failed'].includes(delivery.status),
          ),
      )
      .sort((a, b) => a.order - b.order);
    const position = queue.findIndex((entry) => entry.id === id);
    const adjacent = queue[position + (input.action === 'up' ? -1 : 1)];
    if (adjacent) {
      const order = adjacent.order;
      adjacent.order = request.order;
      request.order = order;
      context.board.db.transaction(() => {
        saveRequest(context, adjacent);
        saveRequest(context, request);
      })();
    }
  }
  if (input.action === 'interrupt') {
    for (const run of context.board
      .list<Run>('run')
      .filter(
        (run) =>
          run.status === 'running' && pending.some((delivery) => delivery.roleId === run.roleId),
      ))
      stopConversationWork(
        context,
        run.threadId ?? run.roleId,
        run.roleId,
        run.rootRunId ?? run.id,
      );
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
}
