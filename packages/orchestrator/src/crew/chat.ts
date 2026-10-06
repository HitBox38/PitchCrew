import { requireRole } from './roles.ts';
import { validateReasoning } from './reasoning.ts';
import { assertProfileReady } from '../profile-sources/mutation.ts';
import { runConfiguration, packetDigest } from './pipeline/snapshots.ts';
import { adapters } from '@pitchcrew/adapters';
import {
  chatInput,
  chatResultSchema,
  type AgentTask,
  type Card,
  type ChatMessage,
  type ChatStreamState,
  type ChatStreamUpdate,
  type RoleId,
  type Run,
  type Role,
} from '@pitchcrew/core';
import { readProfile } from '@pitchcrew/packet';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { CrewContext } from './types.ts';

export function chatState(this: CrewContext): ChatStreamState {
  return {
    messages: this.board.list<ChatMessage>('message'),
    streamingMessages: [...this.streamingMessages.values()],
  };
}
export function chatUpdate(this: CrewContext, includeMessages: boolean): ChatStreamUpdate {
  return includeMessages
    ? this.chatState()
    : { streamingMessages: [...this.streamingMessages.values()] };
}
export function subscribeChat(
  this: CrewContext,
  listener: (messagesChanged: boolean) => void,
): () => void {
  this.chatListeners.add(listener);
  return () => {
    this.chatListeners.delete(listener);
  };
}
export function publishChat(this: CrewContext, messagesChanged: boolean = false): void {
  for (const listener of this.chatListeners) listener(messagesChanged);
}
export function addMessage(
  this: CrewContext,
  threadId: ChatMessage['threadId'],
  from: ChatMessage['from'],
  to: ChatMessage['to'],
  content: string,
  cardId: string | null,
  runId: string | null,
  id: string = randomUUID(),
  notification?: ChatMessage['notification'],
): ChatMessage {
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
  };
  this.board.record('message', message, from, `${from === 'user' ? 'You' : from} messaged ${to}`);
  this.publishChat(true);
  return message;
}
export async function sendChat(this: CrewContext, roleId: RoleId, data: unknown): Promise<Run> {
  const input = chatInput.parse(data);
  if (input.threadId && input.threadId !== 'crew' && input.threadId !== roleId)
    throw new Error('Choose this role’s chat or the crew conversation.');
  // Validate the user override without mutating the saved role. startChatRun
  // rechecks it and reserves the role synchronously before setup awaits.
  if (input.reasoning != null) {
    const role = requireRole(this, roleId);
    validateReasoning(
      { ...role, reasoning: input.reasoning },
      await this.runtimeModels(role.runtime),
    );
  }
  return this.startChatRun(
    roleId,
    input.content,
    input.cardId,
    input.threadId ?? roleId,
    undefined,
    undefined,
    input.reasoning,
  );
}
export async function startChatRun(
  this: CrewContext,
  roleId: RoleId,
  content: string,
  cardId: string | null,
  threadId: ChatMessage['threadId'],
  task?: AgentTask,
  scheduled?: { routineId: string; scheduledFor: string },
  reasoning?: Role['reasoning'],
): Promise<Run> {
  if (this.closing) throw new Error('The daemon is stopping.');
  assertProfileReady(this);
  if (this.profileWriting) throw new Error('Wait for the profile update to finish.');
  const storedRole = requireRole(this, roleId);
  const role = reasoning === undefined ? storedRole : { ...storedRole, reasoning };
  if (reasoning != null)
    validateReasoning(
      role,
      this.runtimes.find((runtime) => runtime.id === role.runtime)!,
    );
  const skills = this.skills(roleId);
  if (this.configuring.has(roleId)) throw new Error('Wait for this role’s settings update.');
  if (!role.enabled) throw new Error('Enable this role in Crew first.');
  if (!this.runtimes.find((r) => r.id === role.runtime)?.available)
    throw new Error('This runtime is not installed. Check Crew settings.');
  if (this.board.list<Run>('run').some((r) => r.roleId === roleId && r.status === 'running'))
    throw new Error('This role is busy. Wait for its run or cancel it first.');
  const card = cardId ? this.board.get<Card>('card', cardId) : null;
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
  };
  const controller = new AbortController();
  const token = randomUUID();
  this.controllers.set(run.id, controller);
  this.capabilities.set(token, { runId: run.id, cardId, roleId });
  this.board.record('run', run, roleId, `${role.name} started a chat turn`);
  if (!task)
    this.addMessage(
      threadId,
      scheduled ? 'system' : 'user',
      roleId,
      scheduled ? `Scheduled action (${scheduled.scheduledFor}):\n${content}` : content,
      cardId,
      run.id,
    );
  const reply: ChatMessage = {
    id: randomUUID(),
    threadId,
    from: roleId,
    to: task ? this.board.get<Run>('run', task.parentRunId).roleId : 'user',
    content: '',
    cardId,
    runId: run.id,
    createdAt: new Date().toISOString(),
  };
  let acceptingReply = true;
  const dir = join(this.directory, 'roles', roleId, 'runs', run.id);
  // Start in the background; HTTP returns the run so the user can cancel setup or execution.
  void (async () => {
    await this.writeRunInstructions(dir, role, skills);
    if (controller.signal.aborted) throw new Error('Run cancelled.');
    const messages = this.board
      .list<ChatMessage>('message')
      .filter((m) => m.threadId === threadId)
      .slice(-40);
    const result = chatResultSchema.parse(
      await adapters[role.runtime].chat({
        card,
        role,
        skills,
        messages,
        request: content,
        profile: await readProfile(this.directory),
        directory: dir,
        mcp: {
          command: process.execPath,
          args: ['--import', import.meta.resolve('tsx'), this.mcpEntry],
          env: { PITCHCREW_RUN_TOKEN: token, PITCHCREW_DAEMON_URL: this.daemonUrl },
        },
        signal: controller.signal,
        onReply: (text) => {
          if (!acceptingReply || controller.signal.aborted || this.closing) return;
          if (text) this.streamingMessages.set(run.id, { ...reply, content: text.slice(0, 12000) });
          else this.streamingMessages.delete(run.id);
          this.publishChat();
        },
        onMessage: (message) => {
          const current = this.board.get<Run>('run', run.id);
          if (!controller.signal.aborted)
            this.board.record('run', { ...current, message }, roleId, message);
        },
      }),
    );
    acceptingReply = false;
    if (controller.signal.aborted) throw new Error('Run cancelled.');
    this.streamingMessages.delete(run.id);
    this.addMessage(threadId, roleId, reply.to, result.reply, cardId, run.id, reply.id);
    this.board.record(
      'run',
      {
        ...run,
        status: 'completed',
        outputPacketDigest: packetDigest(cardId ? this.board.get<Card>('card', cardId) : null),
        message: `${role.name} replied`,
        finishedAt: new Date().toISOString(),
      },
      roleId,
      `${role.name} replied`,
    );
  })()
    .catch((error: unknown) => {
      acceptingReply = false;
      this.streamingMessages.delete(run.id);
      const message = error instanceof Error ? error.message : 'Chat failed.';
      this.board.record(
        'run',
        {
          ...run,
          status: controller.signal.aborted ? 'cancelled' : 'failed',
          message,
          finishedAt: new Date().toISOString(),
        },
        roleId,
        message,
      );
      this.addMessage(threadId, 'system', roleId, message, cardId, run.id);
    })
    .finally(async () => {
      await this.computer.stop(run.id);
      this.controllers.delete(run.id);
      this.capabilities.delete(token);
      this.finishTask(run);
      void this.drainTasks();
    });
  return run;
}
