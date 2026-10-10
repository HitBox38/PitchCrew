import { conversationMessages } from '../conversation-context.ts';
import { conversation, canReadConversation } from '../conversations.ts';
import type { AgentCapabilities } from '@pitchcrew/core';
import { roleIdSchema, type ChatMessage } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';

export async function readMessages(
  this: CrewContext,
  capability: RunCapability,
): Promise<Record<string, unknown>> {
  const run = this.board.get<import('@pitchcrew/core').Run>('run', capability.runId);
  const threads = [
    ...new Set(this.board.list<ChatMessage>('message').map((message) => message.threadId)),
  ].filter((id) => canReadConversation(this, capability.roleId, id));
  return {
    messages: threads
      .flatMap((id) => conversationMessages(this, id, capability.roleId, run.requestId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-100),
  };
}
export async function queueMessage(
  this: CrewContext,
  capability: RunCapability,
  permissions: AgentCapabilities,
  action: 'message' | 'invoke',
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!permissions[action === 'message' ? 'messageAgents' : 'invokeAgents'])
    throw new Error('This capability is disabled for your role.');
  const input = z
    .object({
      roleId: roleIdSchema,
      content: z.string().trim().min(1).max(8000),
      mode: z.enum(['chat', 'workflow']).default('chat'),
      conversationId: z.string().optional(),
    })
    .parse(data);
  if (input.mode === 'workflow' && !permissions.manageWorkflow)
    throw new Error('Workflow capability is disabled for your role.');
  if (input.conversationId) {
    const target = conversation(this, input.conversationId);
    if (
      !target.participants.includes(capability.roleId) ||
      !target.participants.includes(input.roleId) ||
      target.cardId !== capability.cardId ||
      target.kind === 'history'
    )
      throw new Error('Choose a shared conversation with the same job scope.');
  }
  return {
    task: this.enqueue(
      capability,
      input.roleId,
      action === 'message' ? 'chat' : input.mode,
      input.content,
      action,
      input.conversationId,
    ),
  };
}

export function notifyUser(
  this: CrewContext,
  capability: RunCapability,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const input = z
    .object({
      content: z.string().trim().min(1).max(8000),
      kind: z.enum(['message', 'attention']),
      action: z.literal('notify_user').optional(),
    })
    .strict()
    .parse(data);
  const messages = this.board.list<ChatMessage>('message');
  if (messages.filter((m) => m.runId === capability.runId && m.notification).length >= 3)
    throw new Error('Three user notifications maximum per run.');
  const run = this.board.get<import('@pitchcrew/core').Run>('run', capability.runId);
  return {
    message: this.addMessage(
      run.threadId ?? capability.roleId,
      capability.roleId,
      'user',
      input.content,
      capability.cardId,
      capability.runId,
      undefined,
      input.kind,
    ),
  };
}
