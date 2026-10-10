import { cancelUserQuestions } from './user-input/lifecycle.ts';
import { randomUUID } from 'node:crypto';
import {
  conversationInput,
  conversationPatch,
  type Conversation,
  type Role,
  type Card,
  type ChatMessage,
  type ChatRequest,
  type Run,
} from '@pitchcrew/core';
import { requireRole } from './roles.ts';
import type { CrewContext } from './types.ts';
import { stopConversationWork } from './conversation-queue.ts';

export function conversations(context: CrewContext): Conversation[] {
  return context.board.list<Conversation>('conversation');
}
export function conversation(context: CrewContext, id: string): Conversation {
  return context.board.get<Conversation>('conversation', id);
}
export function canReadConversation(context: CrewContext, roleId: string, id: string): boolean {
  const item = conversations(context).find((entry) => entry.id === id);
  return item ? item.participants.includes(roleId) : id === roleId || id === 'crew';
}
export function migrateConversations(context: CrewContext): void {
  const existing = new Set(conversations(context).map((item) => item.id));
  const now = new Date().toISOString();
  const roles = context.board.list<Role>('role');
  for (const role of roles) {
    if (existing.has(role.id)) continue;
    context.board.record(
      'conversation',
      {
        id: role.id,
        title: `${role.name} chat`,
        kind: 'direct',
        participants: [role.id],
        leadId: role.id,
        cardId: null,
        createdBy: 'user',
        createdAt: now,
        updatedAt: now,
        archived: false,
        pinned: false,
        configurations: {},
      },
      'system',
      'Preserved agent conversation',
    );
  }
  if (!existing.has('crew'))
    context.board.record(
      'conversation',
      {
        id: 'crew',
        title: 'Crew history',
        kind: 'history',
        participants: roles.map((role) => role.id),
        leadId: null,
        cardId: null,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
        archived: false,
        pinned: false,
        configurations: {},
      },
      'system',
      'Preserved legacy crew history',
    );
}
export function createConversation(
  context: CrewContext,
  data: unknown,
  actor = 'user',
  kind?: Conversation['kind'],
  extra: Partial<Conversation> = {},
): Conversation {
  const input = conversationInput.parse(data);
  for (const id of input.participants) requireRole(context, id);
  if (input.cardId) context.board.get<Card>('card', input.cardId);
  const leadId =
    input.leadId ?? (actor === 'user' || actor === 'system' ? input.participants[0]! : actor);
  if (!input.participants.includes(leadId)) throw new Error('The lead must be a participant.');
  const now = new Date().toISOString();
  const item: Conversation = {
    ...input,
    id: randomUUID(),
    kind: kind ?? (input.participants.length > 1 ? 'group' : 'direct'),
    leadId,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    archived: false,
    pinned: false,
    configurations: {},
    ...extra,
  };
  context.board.record('conversation', item, actor, `Created ${item.title}`);
  context.publishChat(true);
  return item;
}
export async function updateConversation(
  context: CrewContext,
  id: string,
  data: unknown,
  actor = 'user',
): Promise<Conversation> {
  const current = conversation(context, id);
  const patch = conversationPatch.parse(data);
  if (
    current.kind === 'history' &&
    Object.keys(patch).some((key) => !['archived', 'pinned', 'notifyAll'].includes(key))
  )
    throw new Error('Crew history is read-only.');
  if (
    current.kind === 'agent_dm' &&
    Object.keys(patch).some((key) => !['title', 'archived', 'pinned', 'notifyAll'].includes(key))
  )
    throw new Error('Agent DMs are read-only.');
  const participants = patch.participants ?? current.participants;
  for (const roleId of participants)
    if (current.participants.includes(roleId)) context.board.get<Role>('role', roleId);
    else requireRole(context, roleId);
  if (patch.cardId !== undefined && patch.cardId !== current.cardId) {
    if (
      context.board.list<ChatMessage>('message').some((message) => message.threadId === id) ||
      context.board.list<ChatRequest>('chat_request').some((request) => request.threadId === id)
    )
      throw new Error('Start a separate conversation for a different job.');
    if (patch.cardId) context.board.get<Card>('card', patch.cardId);
  }
  const leadId = patch.leadId === undefined ? current.leadId : patch.leadId;
  if (leadId && !participants.includes(leadId))
    throw new Error('Choose a lead from the remaining participants.');
  for (const [roleId, override] of Object.entries(patch.configurations ?? {})) {
    if (!participants.includes(roleId)) throw new Error('Configure a conversation participant.');
    if (!Object.keys(override).length) continue;
    const configuration = { ...context.board.get<Role>('role', roleId), ...override };
    if (
      !context.runtimes.some((runtime) => runtime.id === configuration.runtime && runtime.available)
    )
      throw new Error('Choose an installed runtime.');
    const catalog = await context.runtimeModels(configuration.runtime);
    if (configuration.model && !catalog.models.some((model) => model.value === configuration.model))
      throw new Error('Choose a supported model.');
    if (
      configuration.reasoning &&
      !catalog.models
        .find((model) => model.value === configuration.model)
        ?.reasoning?.levels.includes(configuration.reasoning)
    )
      throw new Error('Choose a supported reasoning level.');
  }
  // Recheck after model lookup; concurrent edits cannot silently overwrite membership or settings.
  if (JSON.stringify(conversation(context, id)) !== JSON.stringify(current))
    throw new Error('The conversation changed. Refresh and retry.');
  for (const removed of current.participants.filter((roleId) => !participants.includes(roleId))) {
    stopConversationWork(context, id, removed);
    cancelUserQuestions(
      context,
      (q) => q.roleId === removed && (q.threadId === id || q.sourceThreadId === id),
      'The asking agent was removed from the conversation.',
    );
    for (const request of context.board
      .list<ChatRequest>('chat_request')
      .filter((request) => request.threadId === id)) {
      const delivery = request.deliveries.find((entry) => entry.roleId === removed);
      if (delivery && ['queued', 'paused', 'running', 'waiting'].includes(delivery.status)) {
        delivery.status = 'cancelled';
        context.board.record(
          'chat_request',
          request,
          'user',
          'Cancelled removed participant delivery',
        );
      }
    }
  }
  const updated = {
    ...current,
    ...patch,
    kind: current.kind === 'direct' && participants.length > 1 ? ('group' as const) : current.kind,
    participants,
    leadId,
    configurations: { ...current.configurations, ...patch.configurations },
    updatedAt: new Date().toISOString(),
  };
  context.board.record('conversation', updated, actor, `Updated ${current.title}`);
  for (const joined of participants.filter((roleId) => !current.participants.includes(roleId)))
    context.addMessage(
      id,
      'system',
      'crew',
      `${requireRole(context, joined).name} joined the conversation and can read its earlier messages and files.`,
      current.cardId,
      null,
    );
  if (leadId !== current.leadId)
    context.addMessage(
      id,
      'system',
      'crew',
      `Lead changed to ${leadId ? requireRole(context, leadId).name : 'none'}.`,
      current.cardId,
      null,
    );
  context.publishChat(true);
  return conversation(context, id);
}
export function relatedConversation(
  context: CrewContext,
  kind: 'routine' | 'application',
  key: string,
  roleId: string,
  cardId: string | null,
  title: string,
): Conversation {
  const existing = conversations(context).find(
    (item) =>
      item.kind === kind &&
      (kind === 'routine' ? item.routineId === key && item.cardId === cardId : item.cardId === key),
  );
  if (existing) {
    if (!existing.participants.includes(roleId)) {
      const updated = { ...existing, participants: [...existing.participants, roleId] };
      context.board.record('conversation', updated, 'system', 'Added application worker');
      context.addMessage(
        existing.id,
        'system',
        'crew',
        `${requireRole(context, roleId).name} joined the conversation.`,
        cardId,
        null,
      );
      return updated;
    }
    return existing;
  }
  return createConversation(
    context,
    { title, participants: [roleId], cardId },
    'system',
    kind,
    kind === 'routine' ? { routineId: key } : {},
  );
}
export function agentDm(
  context: CrewContext,
  source: string,
  target: string,
  cardId: string | null,
  parentId?: string,
): Conversation {
  if (source === target && parentId) return conversation(context, parentId);
  const participants = [...new Set([source, target])];
  const existing = conversations(context).find(
    (item) =>
      item.kind === 'agent_dm' &&
      item.cardId === cardId &&
      item.parentId === parentId &&
      item.participants.length === participants.length &&
      participants.every((id) => item.participants.includes(id)),
  );
  return (
    existing ??
    createConversation(
      context,
      {
        title: `${requireRole(context, source).name} & ${requireRole(context, target).name}`,
        participants,
        leadId: source,
        cardId,
      },
      source,
      'agent_dm',
      { parentId },
    )
  );
}
export function runConversation(context: CrewContext, run: Run): Conversation | undefined {
  return conversations(context).find((item) => item.id === run.threadId);
}
