import { conversationMessages } from '../conversation-context.ts';
import { z } from 'zod';
import { defaultCapabilities, memoryInput, type AgentMemory, type Run } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import {
  conversation,
  conversations,
  createConversation,
  updateConversation,
  canReadConversation,
} from '../conversations.ts';
import { requireRole } from '../roles.ts';
import type { CrewContext, RunCapability } from '../types.ts';

export async function conversationAction(
  context: CrewContext,
  capability: RunCapability,
  action: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const role = requireRole(context, capability.roleId);
  const permissions = role.capabilities ?? defaultCapabilities;
  if (action === 'conversations')
    return {
      conversations: conversations(context).filter((item) => item.participants.includes(role.id)),
    };
  if (action === 'conversation_messages') {
    const input = z
      .object({
        conversationId: z.string().min(1),
        beforeId: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(40),
      })
      .parse(data);
    if (!canReadConversation(context, role.id, input.conversationId))
      throw new Error('This role cannot access the conversation.');
    const active = context.board.get<Run>('run', capability.runId);
    const messages = conversationMessages(context, input.conversationId, role.id, active.requestId);
    const end = input.beforeId
      ? messages.findIndex((message) => message.id === input.beforeId)
      : messages.length;
    if (end < 0) throw new Error('Message cursor not found.');
    const page = messages.slice(Math.max(0, end - input.limit), end);
    return { messages: page, beforeId: end > input.limit ? page[0]?.id : null };
  }
  if (!permissions.messageAgents) throw new Error('Agent messaging capability is disabled.');
  if (action === 'create_group') {
    const input = z
      .object({ title: z.string(), participants: z.array(z.string()).min(1) })
      .parse(data);
    const run = context.board.get<Run>('run', capability.runId);
    return {
      conversation: createConversation(
        context,
        {
          ...input,
          participants: [...new Set([role.id, ...input.participants])],
          leadId: role.id,
          cardId: capability.cardId,
        },
        role.id,
        'group',
        { parentId: run.threadId },
      ),
    };
  }
  const input = z.object({ conversationId: z.string(), roleId: z.string() }).parse(data);
  const item = conversation(context, input.conversationId);
  if (item.leadId !== role.id || !item.participants.includes(role.id))
    throw new Error('Only the group lead can invite agents or transfer leadership.');
  if (!['group', 'application'].includes(item.kind))
    throw new Error('Choose a group conversation.');
  const target = requireRole(context, input.roleId);
  if (
    action === 'transfer_lead' &&
    (!target.enabled ||
      !context.runtimes.some(
        (runtime) =>
          runtime.id === (item.configurations[target.id]?.runtime ?? target.runtime) &&
          runtime.available,
      ))
  )
    throw new Error('Choose an available participant.');
  return {
    conversation: await updateConversation(
      context,
      item.id,
      action === 'invite_agent'
        ? { participants: [...new Set([...item.participants, target.id])] }
        : { leadId: target.id },
      role.id,
    ),
  };
}
export function memoryAction(
  context: CrewContext,
  capability: RunCapability,
  action: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (action === 'recall_memory') {
    const { query } = z.object({ query: z.string().max(200).default('') }).parse(data);
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const memories = context.board
      .list<AgentMemory>('agent_memory')
      .filter(
        (memory) =>
          memory.roleId === capability.roleId &&
          !memory.deleted &&
          words.every((word) =>
            `${memory.content} ${memory.tags.join(' ')}`.toLowerCase().includes(word),
          ),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 10);
    const run = context.board.get<Run>('run', capability.runId);
    context.board.record(
      'run',
      {
        ...run,
        memoryIds: [...new Set([...(run.memoryIds ?? []), ...memories.map((memory) => memory.id)])],
      },
      capability.roleId,
      'Recalled agent memory',
    );
    return { memories };
  }
  const input = memoryInput.parse(data);
  const run = context.board.get<Run>('run', capability.runId);
  const threadId = run.threadId ?? capability.roleId;
  if (!canReadConversation(context, capability.roleId, threadId))
    throw new Error('Conversation access was removed.');
  const message = conversationMessages(context, threadId, capability.roleId, run.requestId).at(-1);
  const memory: AgentMemory = {
    id: randomUUID(),
    roleId: capability.roleId,
    ...input,
    source: { threadId, messageId: message?.id, runId: run.id },
    updatedAt: new Date().toISOString(),
    deleted: false,
  };
  context.board.record('agent_memory', memory, capability.roleId, 'Saved source-backed memory');
  return { memory };
}
export function editMemory(context: CrewContext, id: string, data?: unknown): AgentMemory {
  const current = context.board.get<AgentMemory>('agent_memory', id);
  const memory = {
    ...current,
    ...(data === undefined ? { deleted: true } : memoryInput.parse(data)),
    updatedAt: new Date().toISOString(),
  };
  context.board.record(
    'agent_memory',
    memory,
    'user',
    data === undefined ? 'Deleted memory' : 'Edited memory',
  );
  return memory;
}
