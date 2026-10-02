import { z } from 'zod';
import { roleIds, type RoleId } from './states.ts';

export interface ChatMessage {
  id: string;
  threadId: RoleId | 'crew';
  from: RoleId | 'user' | 'system';
  to: RoleId | 'user' | 'crew';
  content: string;
  cardId: string | null;
  runId: string | null;
  createdAt: string;
  notification?: 'message' | 'attention';
}
export interface ChatStreamState {
  messages: ChatMessage[];
  streamingMessages: ChatMessage[];
}
export interface ChatStreamUpdate {
  // Saved history is sent on connection and when messages change, never per token.
  messages?: ChatMessage[];
  streamingMessages: ChatMessage[];
}
export const chatInput = z.object({
  content: z.string().trim().min(1).max(8000),
  cardId: z.uuid().nullable().default(null),
  threadId: z.union([z.enum(roleIds), z.literal('crew')]).optional(),
});
export const chatResultSchema = z.object({ reply: z.string().trim().min(1).max(12000) });
export type ChatResult = z.infer<typeof chatResultSchema>;
