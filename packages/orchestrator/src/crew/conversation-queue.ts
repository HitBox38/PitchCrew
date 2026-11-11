import { queueMayStart } from './queue/dispatch.ts';
import { submitChatOnce } from './chat-submissions.ts';
import { pauseForUnfinishedHead, resumeHeadRequest } from './queue/recovery.ts';
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
import { deliveryLifecycle, chatReferenceInput } from '@pitchcrew/core';
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
import {
  openRoundRoots,
  refreshOpenRounds,
  runIsDelegate,
  startRound,
} from './delegation-rounds.ts';
import { userDelegationInput } from '@pitchcrew/core';
import type { CrewContext } from './types.ts';
export const saveRequest = (context: CrewContext, request: ChatRequest, publish = true): void => {
  const queue = ensureQueue(context, request.threadId, request.rootRunId);
  if (
    !context.board.list<ChatRequest>('chat_request').some((r) => r.id === request.id) &&
    !queueRequests(context, queue.id).length &&
    !activeQueues(context).has(queue.id)
  )
    patchQueue(context, queue.id, { order: nextOrder(context) });
  context.board.record('chat_request', request, 'user', 'Updated queued message');
  if (publish) context.publishChat(true);
};

const prepareInterrupt = (context: CrewContext, id: string, effects: (() => void)[]) => {
  stopConversationWork(context, id, undefined, undefined, (effect) => effects.push(effect));
  const queue = ensureQueue(context, id);
  patchQueue(context, queue.id, { paused: false, pauseKind: undefined, reason: '' });
  for (const pending of queueRequests(context, queue.id)) {
    for (const entry of pending.deliveries)
      if (entry.status === 'paused') entry.status = entry.runId ? 'cancelled' : 'queued';
    saveRequest(context, pending, false);
  }
};

const publishAccepted = (context: CrewContext, effects: (() => void)[]) => {
  // Durable acceptance survives failed observers; remaining aborts and dispatch still run.
  for (const effect of [...effects, () => context.publishChat(true)]) {
    try {
      effect();
    } catch {
      /* Live observers recover from the next authoritative snapshot. */
    }
  }
  void drainConversationQueue(context);
};

const requestOrder = (context: CrewContext, intent: 'queue' | 'interrupt') => {
  const direction = intent === 'interrupt' ? 'ASC' : 'DESC';
  const bound = context.board.db
    .prepare(
      `SELECT json_extract(json,'$.order') AS position FROM entities
       WHERE kind='chat_request' AND json_type(json,'$.order') IN ('integer','real')
       ORDER BY json_extract(json,'$.order') ${direction} LIMIT 1`,
    )
    .get() as { position: number } | undefined;
  const now = Date.now();
  return intent === 'interrupt'
    ? Math.min(now, bound?.position ?? now) - 1
    : Math.max(now, (bound?.position ?? 0) + 1);
};
export const sendConversation = async (
  context: CrewContext,
  id: string,
  data: unknown,
): Promise<ChatRequest> => {
  const input = chatInput.parse(data);
  const { intent } = z
    .object({ intent: z.enum(['queue', 'interrupt']).default('queue') })
    .parse(data);
  const { clientRequestId } = input;
  const payload = {
    content: input.content,
    references: input.references ?? [],
    attachments: input.attachments,
  };
  return submitChatOnce(context, id, clientRequestId, { ...payload, intent }, (submission) =>
    sendConversationPrepared(context, id, input, intent, submission),
  );
};
const sendConversationPrepared = async (
  context: CrewContext,
  id: string,
  input: z.infer<typeof chatInput>,
  intent: 'queue' | 'interrupt',
  submission?: ChatRequest['submission'],
): Promise<ChatRequest> => {
  const item = conversation(context, id);
  if (item.kind === 'history' || item.kind === 'agent_dm')
    throw new Error('This conversation is read-only.');
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
  let committed = false;
  try {
    if (JSON.stringify(conversation(context, id)) !== JSON.stringify(item))
      throw new Error('The conversation changed. Try sending again.');
    if (isDeepReviewRequest(input.content)) {
      const effects: (() => void)[] = [];
      const request = context.board.db.transaction(() => {
        if (intent === 'interrupt') prepareInterrupt(context, id, effects);
        return queueDeepReviewChat(
          context,
          item,
          input.content,
          files,
          references,
          submission,
          (effect) => effects.push(effect),
          requestOrder(context, intent),
        );
      })();
      committed = true;
      publishAccepted(context, effects);
      return request;
    }
    const request: ChatRequest = {
      ...(submission ? { submission } : {}),
      id: randomUUID(),
      threadId: id,
      messageId: randomUUID(),
      content: input.content,
      references,
      attachments: files,
      createdAt: new Date().toISOString(),
      order: requestOrder(context, intent),
      deliveries: eligible.map((roleId) => ({ roleId, status: 'queued', runId: null, error: '' })),
    };
    const effects: (() => void)[] = [];
    context.board.db.transaction(() => {
      if (intent === 'interrupt') prepareInterrupt(context, id, effects);
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
        false,
      );
      saveRequest(context, request, false);
    })();
    committed = true;
    publishAccepted(context, effects);
    return request;
  } catch (error) {
    if (!committed) await removeAttachments(context.directory, files);
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
        if (!requestIsHead(context, current)) {
          const head = queueRequests(context, queue.id)[0];
          if (head && !queue.paused) pauseForUnfinishedHead(context, head);
          continue;
        }
        // Avoid reading Profile files for every queued action while its lane or all slots are busy.
        // Recheck admission after asynchronous validation below before reserving the delivery.
        if (
          launchProblem(context, {
            cardId: item.cardId,
            threadId: item.id,
            roleId: delivery.roleId,
            rootRunId: current.rootRunId ?? current.id,
          })
        )
          continue;
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
                  current.boardAction === 'reevaluate' ||
                    (current.userInputId
                      ? context.board.get<Run>(
                          'run',
                          context.board.get<import('@pitchcrew/core').UserInputRequest>(
                            'user_input',
                            current.userInputId,
                          ).runId,
                        ).purpose === 'packet-evaluation'
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
    const head = queueRequests(context, laneId(context, request.threadId, request.rootRunId))[0];
    if (head) pauseForUnfinishedHead(context, head);
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
      : [
          ...runs.filter((run) => run.threadId === id).map((run) => run.rootRunId ?? run.id),
          ...openRoundRoots(context, id),
        ],
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
  refreshOpenRounds(context);
  for (const request of context.board
    .list<ChatRequest>('chat_request')
    .filter((request) => request.threadId === id && (!rootId || request.id === rootId))) {
    let changed = false;
    for (const delivery of request.deliveries)
      if (
        (!roleId || delivery.roleId === roleId) &&
        deliveryLifecycle.is('moving', delivery.status)
      ) {
        delivery.status = 'paused';
        changed = true;
      }
    if (changed) saveRequest(context, request);
  }
  context.publishChat(true);
};
/** The user assigns one message to several agents; the conversation's lead collects their results. */
export const sendDelegation = async (
  context: CrewContext,
  id: string,
  data: unknown,
): Promise<ChatRequest> => {
  const item = conversation(context, id);
  if (item.kind === 'history' || item.kind === 'agent_dm')
    throw new Error('This conversation is read-only.');
  const input = userDelegationInput.parse(data);
  const leadId = item.leadId ?? item.participants[0];
  if (!leadId || !item.participants.includes(leadId))
    throw new Error('Choose a lead for this conversation before delegating.');
  const lead = context.board.get<Role>('role', leadId);
  const leadConfig = { ...lead, ...item.configurations[leadId] };
  if (
    !lead.enabled ||
    lead.retiredAt ||
    !context.runtimes.some((runtime) => runtime.id === leadConfig.runtime && runtime.available)
  )
    throw new Error(`${lead.name} must be enabled with an available runtime to collect results.`);
  await Promise.all(
    [leadId, ...input.roleIds].map((roleId) => {
      const role = context.board.get<Role>('role', roleId);
      return context.runtimeMaintenance.refreshOnRetry({ ...role, ...item.configurations[roleId] });
    }),
  );
  if (JSON.stringify(conversation(context, id)) !== JSON.stringify(item))
    throw new Error('The conversation changed. Try sending again.');
  const request: ChatRequest = {
    id: randomUUID(),
    threadId: id,
    messageId: randomUUID(),
    content: input.content,
    attachments: [],
    createdAt: new Date().toISOString(),
    order: Math.max(
      Date.now(),
      ...context.board.list<ChatRequest>('chat_request').map((entry) => entry.order + 1),
    ),
    deliveries: [],
  };
  context.board.db.transaction(() => {
    const round = startRound(context, {
      leadId,
      threadId: id,
      cardId: item.cardId,
      initiator: 'user',
      parentRunId: null,
      requestId: request.id,
      rootRunId: request.id,
      delegates: input.roleIds.map((roleId) => ({ roleId, content: input.content })),
    });
    request.roundId = round.id;
    context.addMessage(
      id,
      'user',
      item.kind === 'group' || item.kind === 'application' ? 'crew' : leadId,
      input.content,
      item.cardId,
      null,
      request.messageId,
    );
    saveRequest(context, request);
  })();
  void context.drainTasks();
  return request;
};
export const stopConversationWork = (
  context: CrewContext,
  id: string,
  roleId?: string,
  rootId?: string,
  effect: (action: () => void) => void = (action) => action(),
): void => {
  if (roleId) return stopConversationBranch(context, id, roleId, rootId);
  const queue = ensureQueue(context, id);
  patchQueue(
    context,
    queue.id,
    { paused: true, pauseKind: 'user', reason: 'Paused by you.' },
    effect,
  );
  const runs = context.board.list<Run>('run');
  const owned = runs.filter(
    (run) =>
      (queue.cardId ? run.cardId === queue.cardId : run.threadId === id) &&
      (!rootId || (run.rootRunId ?? run.id) === rootId),
  );
  const roots = new Set([
    ...owned.map((run) => run.rootRunId ?? run.id),
    ...(rootId ? [] : openRoundRoots(context, id)),
  ]);
  cancelUserQuestions(
    context,
    (q) => roots.has(runs.find((run) => run.id === q.runId)?.rootRunId ?? q.runId),
    'Stopped by you.',
    effect,
  );
  for (const run of runs)
    if (roots.has(run.rootRunId ?? run.id)) {
      effect(() => {
        context.controllers.get(run.id)?.abort();
        context.streamingMessages.delete(run.id);
      });
    }
  for (const task of context.board.list<AgentTask>('task'))
    if (roots.has(task.rootRunId) && task.status === 'queued')
      context.board.record(
        'task',
        { ...task, status: 'cancelled', error: 'Stopped by you.' },
        'user',
        'Cancelled crew follow-up',
      );
  refreshOpenRounds(context);
  for (const request of queueRequests(context, queue.id)) {
    for (const entry of request.deliveries) {
      if (entry.status === 'running') entry.status = 'paused';
      else if (entry.status === 'queued') entry.status = 'paused';
    }
    saveRequest(context, request, false);
  }
  effect(() => context.publishChat(true));
};
const finishQueueRun = (context: CrewContext, run: Run): void => {
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
  // A failed or stopped delegate is a result for the lead: the round keeps its admitted chain and
  // the lane stays running so the collection turn can start once every delegate settles.
  const delegate = runIsDelegate(context, finished);
  if (
    finished.status === 'waiting' ||
    (['failed', 'cancelled'].includes(finished.status) && !delegate)
  )
    context.queueChains.delete(scope);
  if (scope.startsWith('routine:')) return;
  const queue = ensureQueue(context, thread, run.rootRunId);
  if (finished.status === 'failed' && !delegate)
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
    if (input.action === 'next' && ensureQueue(context, request.threadId, request.rootRunId).paused)
      throw new Error('Resume the queue first, or choose Send now and resume queue.');
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
    deliveryLifecycle.is('unsent', delivery.status),
  );
  if (!pending.length && input.action !== 'remove')
    throw new Error('This request has no pending deliveries.');
  if (input.action === 'resume') {
    resumeHeadRequest(context, request);
    void drainConversationQueue(context);
    return context.board.get<ChatRequest>('chat_request', id);
  }
  if (input.action === 'edit') {
    if (request.userInputId)
      throw new Error('Your answer is already saved. Send a correction instead.');
    if (
      request.deliveries.some(
        (delivery) => delivery.runId || !deliveryLifecycle.is('unsent', delivery.status),
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
      deliveryLifecycle.is('stopped', delivery.status),
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
      if (deliveryLifecycle.is('unsent', delivery.status)) delivery.status = 'cancelled';
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
  if (input.action === 'interrupt')
    for (const delivery of request.deliveries)
      if (
        deliveryLifecycle.is('stopped', delivery.status) &&
        canReadConversation(context, delivery.roleId, request.threadId)
      )
        delivery.status = 'queued';
  if (input.action === 'interrupt') {
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
