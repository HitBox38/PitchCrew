import { failureCategory } from '@pitchcrew/core/operational-logs';
import { reserveLaunch } from './queue/admission.ts';
import { ensureQueue } from './queue/state.ts';
import { selectedChatSkills } from './chat-references.ts';
import { activityRuns, recordChatActivity, finishChatActivity } from './chat-activity.ts';
import { recordOperationalLog } from '../telemetry/logs.ts';
import { endQuestionTurn, finishUserContinuation, waitingOnUser } from './user-input/lifecycle.ts';
import { conversationMessages } from './conversation-context.ts';
import { prepareSession, finishSession } from './sessions.ts';
import { completeContinuation } from './continuation.ts';
import { conversations, canReadConversation } from './conversations.ts';
import { drainConversationQueue, finishDelivery } from './conversation-queue.ts';
import { requireRole } from './roles.ts';
import { saveAttachments, removeAttachments, prepareAttachments } from './attachments/storage.ts';
import { validateReasoning } from './reasoning.ts';
import { assertProfileReady } from '../profile-sources/mutation.ts';
import { runConfiguration, packetDigest } from './pipeline/snapshots.ts';
import { adapters } from '@pitchcrew/adapters';
import { beginAiRun } from '../telemetry/ai.ts';
import {
  defaultCapabilities,
  chatInput,
  chatResultSchema,
  type AgentTask,
  type Card,
  type ChatMessage,
  type ChatAttachment,
  type ChatStreamState,
  type ChatStreamUpdate,
  type RoleId,
  type Run,
  type Role,
} from '@pitchcrew/core';
import { readProfile } from '@pitchcrew/packet';
import { randomUUID, createHash } from 'node:crypto';
import { join } from 'node:path';
import type { CrewContext } from './types.ts';

export const chatState = (context: CrewContext): ChatStreamState => {
  return {
    activityRuns: activityRuns(context, true),
    userInputs: context.board.list('user_input'),
    messages: context.board.list<ChatMessage>('message'),
    streamingMessages: [...context.streamingMessages.values()],
  };
};
export const chatUpdate = (context: CrewContext, includeMessages: boolean): ChatStreamUpdate => {
  return includeMessages
    ? context.chatState()
    : {
        streamingMessages: [...context.streamingMessages.values()],
        activityRuns: activityRuns(context),
      };
};
export const subscribeChat = (
  context: CrewContext,
  listener: (messagesChanged: boolean) => void,
): (() => void) => {
  context.chatListeners.add(listener);
  return () => {
    context.chatListeners.delete(listener);
  };
};
export const publishChat = (context: CrewContext, messagesChanged: boolean = false): void => {
  for (const listener of context.chatListeners) listener(messagesChanged);
};
export const addMessage = (
  context: CrewContext,
  threadId: ChatMessage['threadId'],
  from: ChatMessage['from'],
  to: ChatMessage['to'],
  content: string,
  cardId: string | null,
  runId: string | null,
  id: string = randomUUID(),
  notification?: ChatMessage['notification'],
  attachments?: ChatAttachment[],
  references?: ChatMessage['references'],
): ChatMessage => {
  const message: ChatMessage = {
    id,
    threadId,
    from,
    to,
    content,
    cardId,
    runId,
    createdAt: new Date().toISOString(),
    ...(notification ? { notification } : {}),
    ...(attachments?.length ? { attachments } : {}),
    ...(references?.length ? { references } : {}),
  };
  const currentConversation = conversations(context).find((item) => item.id === threadId);
  if (currentConversation)
    context.board.record(
      'conversation',
      { ...currentConversation, archived: false, updatedAt: message.createdAt },
      from,
      'Conversation activity',
    );
  context.board.record(
    'message',
    message,
    from,
    `${from === 'user' ? 'You' : from} messaged ${to}`,
  );
  context.publishChat(true);
  return message;
};
export const sendChat = async (
  context: CrewContext,
  roleId: RoleId,
  data: unknown,
): Promise<Run> => {
  const input = chatInput.parse(data);
  if (input.threadId === 'crew' && conversations(context).some((item) => item.id === 'crew'))
    throw new Error('Crew history is read-only. Start a group conversation.');
  if (input.threadId && input.threadId !== 'crew' && input.threadId !== roleId)
    throw new Error('Choose this role’s chat or the crew conversation.');
  // Validate the user override without mutating the saved role. startChatRun
  // rechecks it and reserves the role synchronously before setup awaits.
  if (input.reasoning != null) {
    const role = requireRole(context, roleId);
    validateReasoning(
      { ...role, reasoning: input.reasoning },
      await context.runtimeModels(role.runtime),
    );
  }
  const attachments = await saveAttachments(context.directory, input.attachments);
  try {
    return await context.startChatRun(
      roleId,
      input.content,
      input.cardId,
      input.threadId ?? roleId,
      undefined,
      undefined,
      input.reasoning,
      attachments,
    );
  } catch (error) {
    await removeAttachments(context.directory, attachments);
    throw error;
  }
};
const startChatRunPrepared = async (
  context: CrewContext,
  roleId: RoleId,
  content: string,
  cardId: string | null,
  threadId: ChatMessage['threadId'],
  task?: AgentTask,
  scheduled?: { routineId: string; scheduledFor: string },
  reasoning?: Role['reasoning'],
  attachments?: ChatAttachment[],
  delivery?: { requestId: string; rootRunId: string },
): Promise<Run> => {
  if (context.closing) throw new Error('The daemon is stopping.');
  assertProfileReady(context);
  if (context.profileWriting) throw new Error('Wait for the profile update to finish.');
  if (waitingOnUser(context, threadId, roleId))
    throw new Error('Answer or cancel this agent’s pending question first.');
  const storedRole = requireRole(context, roleId);
  const conversation = conversations(context).find((item) => item.id === threadId);
  if (
    !conversation &&
    context.board.db
      .prepare(
        "SELECT 1 FROM entities WHERE kind='conversation' AND id=? AND json_extract(json,'$.deletedAt') IS NOT NULL",
      )
      .get(threadId)
  )
    throw new Error('This conversation was deleted. Start a new conversation.');
  if (conversation && !canReadConversation(context, roleId, threadId))
    throw new Error('This role cannot access the conversation.');
  const configuredRole = scheduled
    ? storedRole
    : { ...storedRole, ...conversation?.configurations[roleId] };
  const role = reasoning === undefined ? configuredRole : { ...configuredRole, reasoning };
  if (reasoning != null)
    validateReasoning(
      role,
      context.runtimes.find((runtime) => runtime.id === role.runtime)!,
    );
  const skills = context.skills(roleId);
  const selectedSkills = delivery
    ? selectedChatSkills(
        context,
        context.board.get<import('@pitchcrew/core').ChatRequest>('chat_request', delivery.requestId)
          .references,
        roleId,
      )
    : [];
  if (context.configuring.has(roleId)) throw new Error('Wait for this role’s settings update.');
  if (!role.enabled) throw new Error('Enable this role in Crew first.');
  if (!context.runtimes.find((r) => r.id === role.runtime)?.available)
    throw new Error('This runtime is not installed. Check Crew settings.');
  const card = cardId ? context.board.get<Card>('card', cardId) : null;
  const run: Run = {
    id: randomUUID(),
    cardId,
    roleId,
    runtime: role.runtime,
    configuration: runConfiguration(role, skills),
    inputPacketDigest: packetDigest(card),
    mode: 'chat',
    threadId,
    status: 'running',
    message: 'Preparing a reply…',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    ...(task ? { rootRunId: task.rootRunId, taskId: task.id } : {}),
    ...scheduled,
    ...(delivery ? { requestId: delivery.requestId, rootRunId: delivery.rootRunId } : {}),
  };
  const controller = new AbortController();
  const token = randomUUID();
  context.controllers.set(run.id, controller);
  context.capabilities.set(token, { runId: run.id, cardId, roleId });
  context.board.record('run', run, roleId, `${role.name} started a chat turn`);
  if (!task && !delivery)
    context.addMessage(
      threadId,
      scheduled ? 'system' : 'user',
      roleId,
      scheduled ? `Scheduled action (${scheduled.scheduledFor}):\n${content}` : content,
      cardId,
      run.id,
      undefined,
      undefined,
      attachments,
    );
  const reply: ChatMessage = {
    id: randomUUID(),
    threadId,
    from: roleId,
    to: task ? context.board.get<Run>('run', task.parentRunId).roleId : 'user',
    content: '',
    cardId,
    runId: run.id,
    createdAt: new Date().toISOString(),
  };
  let acceptingReply = true;
  const dir = join(context.directory, 'roles', roleId, 'runs', run.id);
  let nativeSession: ReturnType<typeof prepareSession> | undefined;
  const ai = beginAiRun(context.diagnostics, 'chat');
  // Start in the background; HTTP returns the run so the user can cancel setup or execution.
  void (async () => {
    await context.writeRunInstructions(dir, role, skills);
    if (controller.signal.aborted) throw new Error('Run cancelled.');
    if (!canReadConversation(context, roleId, threadId))
      throw new Error('Conversation access was removed.');
    const summary = conversation?.summary;
    const permittedMessages = conversationMessages(context, threadId, roleId, delivery?.requestId);
    const messages = permittedMessages
      .filter((m) => m.threadId === threadId && (!summary || !summary.sources.includes(m.id)))
      .slice(-40);
    if (summary)
      messages.unshift({
        id: 'summary',
        threadId,
        from: 'system',
        to: roleId,
        content: `Continuation summary (retrieve original sources through chat tools when needed):\n${summary.content}`,
        cardId,
        runId: null,
        createdAt: summary.through,
      });
    if (conversation && adapters[role.runtime].sessionSupport === 'resume') {
      nativeSession = prepareSession(context, role, skills, conversation, messages);
      await context.writeRunInstructions(nativeSession.directory, role, skills);
    }
    const attachments = await prepareAttachments(
      context.directory,
      dir,
      messages,
      controller.signal,
    );
    const profile = await readProfile(context.directory);
    context.board.record(
      'run',
      {
        ...context.board.get<Run>('run', run.id),
        profileDigest: createHash('sha256').update(JSON.stringify(profile)).digest('hex'),
      },
      roleId,
      'Recorded run Profile version',
    );
    const output = await ai.observe(
      () =>
        adapters[role.runtime].chat({
          card,
          role,
          skills,
          selectedSkills,
          messages: nativeSession?.messages ?? messages,
          session: nativeSession
            ? {
                id: nativeSession.session.nativeId ?? undefined,
                directory: nativeSession.directory,
              }
            : undefined,
          onSession: nativeSession?.onSession,
          attachments,
          request: content,
          conversation: conversation
            ? {
                id: conversation.id,
                kind: conversation.kind,
                leadId: conversation.leadId,
                participants: conversation.participants,
              }
            : undefined,
          profile,
          directory: dir,
          mcp: {
            command: process.execPath,
            args: ['--import', import.meta.resolve('tsx'), context.mcpEntry],
            env: { PITCHCREW_RUN_TOKEN: token, PITCHCREW_DAEMON_URL: context.daemonUrl },
          },
          signal: controller.signal,
          onActivity: (update) => {
            if (acceptingReply) recordChatActivity(context, run.id, update);
          },
          onReply: (text) => {
            if (!acceptingReply || controller.signal.aborted || context.closing) return;
            if (text)
              context.streamingMessages.set(run.id, { ...reply, content: text.slice(0, 12000) });
            else context.streamingMessages.delete(run.id);
            context.publishChat();
          },
          onMessage: (message) => {
            const current = context.board.get<Run>('run', run.id);
            if (!controller.signal.aborted)
              context.board.record('run', { ...current, message }, roleId, message);
          },
        }),
      controller.signal,
    );
    acceptingReply = false;
    if (endQuestionTurn(context, run)) {
      if (nativeSession) finishSession(context, nativeSession.session, null, true);
      return;
    }
    const result = chatResultSchema.parse(output);
    if (controller.signal.aborted) throw new Error('Run cancelled.');
    context.streamingMessages.delete(run.id);
    const memoryIds = context.board.get<Run>('run', run.id).memoryIds;
    if (result.reply) {
      const saved = context.addMessage(
        threadId,
        roleId,
        reply.to,
        result.reply,
        cardId,
        run.id,
        reply.id,
      );
      if (memoryIds?.length) {
        context.board.record('message', { ...saved, memoryIds }, roleId, 'Recorded memory sources');
        context.publishChat(true);
      }
    }
    const summarizing =
      run.requestId &&
      context.board.get<import('@pitchcrew/core').ChatRequest>('chat_request', run.requestId)
        .summarize;
    if (
      !summarizing &&
      conversation &&
      ['group', 'application'].includes(conversation.kind) &&
      (storedRole.capabilities ?? defaultCapabilities).messageAgents
    ) {
      for (const target of [
        ...new Set(
          [...result.reply.matchAll(/(?:^|\s)@([a-z][a-z0-9-]*)\b/g)].map((match) => match[1]!),
        ),
      ].filter((id) => conversation.participants.includes(id))) {
        try {
          context.enqueue(
            { runId: run.id, roleId, cardId },
            target,
            'chat',
            result.reply,
            'message',
            threadId,
          );
        } catch (error) {
          context.addMessage(
            threadId,
            'system',
            'user',
            error instanceof Error ? error.message : 'Could not queue the mentioned agent.',
            cardId,
            run.id,
          );
        }
      }
    }
    if (nativeSession)
      finishSession(
        context,
        nativeSession.session,
        result.reply ? reply.id : (messages.at(-1)?.id ?? null),
        false,
      );
    await completeContinuation(context, run, result.reply, [
      ...new Set([
        ...(summary?.sources ?? []),
        ...permittedMessages.map((message) => message.id),
        reply.id,
      ]),
    ]);
    context.board.record(
      'run',
      {
        ...context.board.get<Run>('run', run.id),
        status: 'completed',
        memoryIds: context.board.get<Run>('run', run.id).memoryIds,
        outputPacketDigest: packetDigest(
          context.board.list<Card>('card').find((card) => card.id === cardId) ?? null,
        ),
        message: `${role.name} replied`,
        finishedAt: new Date().toISOString(),
      },
      roleId,
      `${role.name} replied`,
    );
  })()
    .catch((error: unknown) => {
      acceptingReply = false;
      if (nativeSession) finishSession(context, nativeSession.session, null, true);
      context.streamingMessages.delete(run.id);
      if (endQuestionTurn(context, run)) return;
      ai.fail(error);
      recordOperationalLog(context.diagnostics, {
        code: controller.signal.aborted ? 'runtime_run_cancelled' : 'runtime_run_failed',
        area: 'chat',
        failure_category: controller.signal.aborted ? 'aborted' : failureCategory(error),
      });
      const message = error instanceof Error ? error.message : 'Chat failed.';
      context.board.record(
        'run',
        {
          ...context.board.get<Run>('run', run.id),
          status: controller.signal.aborted ? 'cancelled' : 'failed',
          message,
          finishedAt: new Date().toISOString(),
        },
        roleId,
        message,
      );
      context.addMessage(threadId, 'system', roleId, message, cardId, run.id);
    })
    .finally(async () => {
      finishChatActivity(context, run.id);
      const outcome = context.board.get<Run>('run', run.id).status;
      ai.finish(outcome === 'running' ? 'failed' : outcome);
      await context.computer.stop(run.id);
      context.controllers.delete(run.id);
      context.capabilities.delete(token);
      finishUserContinuation(context, run);
      context.finishTask(run);
      finishDelivery(context, run);
      void drainConversationQueue(context);
      void context.drainTasks();
    });
  return run;
};

export const startChatRun = async (
  context: CrewContext,
  ...args: Parameters<CrewContext['startChatRun']>
): Promise<Run> => {
  const [roleId, , , threadId, , scheduled] = args;
  const stored = requireRole(context, roleId);
  if (!stored.enabled) throw new Error('Enable this role in Crew first.');
  const item = conversations(context).find((candidate) => candidate.id === threadId);
  const role = scheduled ? stored : { ...stored, ...item?.configurations[roleId] };
  if (!args[4] && !args[5] && !args[8]) await context.runtimeMaintenance.refreshOnRetry(role);
  if (!scheduled || args[2])
    ensureQueue(context, threadId, args[4]?.rootRunId ?? args[8]?.rootRunId);
  return reserveLaunch(
    context,
    {
      cardId: args[2],
      threadId,
      roleId,
      rootRunId: args[4]?.rootRunId ?? args[8]?.rootRunId,
      routineId: scheduled?.routineId,
    },
    () =>
      context.runtimeMaintenance.guard(
        role,
        () => startChatRunPrepared(context, ...args),
        false,
        () => {
          const currentRole = requireRole(context, roleId);
          return scheduled
            ? currentRole
            : {
                ...currentRole,
                ...conversations(context).find((entry) => entry.id === threadId)?.configurations[
                  roleId
                ],
              };
        },
      ),
  );
};
