import { z } from 'zod';
import { roleIdSchema } from './roles.ts';
import { runtimeIds } from './states.ts';
import { reasoningLevels } from './reasoning.ts';
import type { ChatAttachment } from './chat-attachments.ts';
import type { RuntimeConfiguration } from './runtime.ts';

export interface Conversation {
  id: string;
  title: string;
  kind: 'direct' | 'group' | 'agent_dm' | 'history' | 'routine' | 'application';
  participants: string[];
  leadId: string | null;
  cardId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  pinned: boolean;
  notifyAll?: boolean;
  configurations: Record<string, Partial<RuntimeConfiguration>>;
  parentId?: string;
  routineId?: string;
  summary?: { content: string; through: string; sources: string[] };
}
export interface ChatRequest {
  id: string;
  threadId: string;
  messageId: string;
  content: string;
  attachments: ChatAttachment[];
  createdAt: string;
  order: number;
  deliveries: {
    roleId: string;
    status: 'queued' | 'paused' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
    runId: string | null;
    error: string;
  }[];
  summarize?: boolean;
  userInputId?: string;
  rootRunId?: string;
  mode?: 'chat' | 'workflow';
}
export interface AgentMemory {
  id: string;
  roleId: string;
  content: string;
  tags: string[];
  source: { threadId: string; messageId?: string; runId?: string };
  updatedAt: string;
  deleted: boolean;
}
export const conversationInput = z.object({
  title: z.string().trim().min(1).max(120),
  participants: z
    .array(roleIdSchema)
    .min(1)
    .transform((ids) => [...new Set(ids)]),
  leadId: roleIdSchema.optional(),
  cardId: z.uuid().nullable().default(null),
});
export const conversationPatch = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  participants: z
    .array(roleIdSchema)
    .min(1)
    .transform((ids) => [...new Set(ids)])
    .optional(),
  leadId: roleIdSchema.nullable().optional(),
  cardId: z.uuid().nullable().optional(),
  archived: z.boolean().optional(),
  pinned: z.boolean().optional(),
  notifyAll: z.boolean().optional(),
  configurations: z
    .record(
      roleIdSchema,
      z.object({
        runtime: z.enum(runtimeIds).optional(),
        model: z.string().max(200).optional(),
        reasoning: z.enum(reasoningLevels).nullable().optional(),
      }),
    )
    .optional(),
});
export const memoryInput = z.object({
  content: z.string().trim().min(1).max(8000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export interface ConversationSession {
  id: string;
  nativeId: string | null;
  directoryId: string;
  threadId: string;
  roleId: string;
  runtime: RuntimeConfiguration['runtime'];
  revision: string;
  lastMessageId: string | null;
  invalid: boolean;
}
