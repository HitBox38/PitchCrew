import { roleIdSchema } from './roles.ts';
import { reasoningLevels } from './reasoning.ts';
import { z } from 'zod';
import { type RoleId } from './states.ts';
import {
  chatAttachmentLimits,
  chatAttachmentMime,
  type ChatAttachment,
} from './chat-attachments.ts';

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
  attachments?: ChatAttachment[];
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
export const chatInput = z
  .object({
    content: z.string().trim().max(8000).default(''),
    attachments: z
      .array(
        z.object({
          name: z
            .string()
            .refine(
              (name) => !!chatAttachmentMime(name),
              'Choose a text, PDF, DOCX, PNG, JPEG, WebP or GIF file with a valid filename.',
            ),
          data: z
            .string()
            .max(Math.ceil(chatAttachmentLimits.bytes / 3) * 4)
            .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Invalid attachment encoding.')
            .refine((data) => data.length % 4 === 0, 'Invalid attachment encoding.'),
        }),
      )
      .max(chatAttachmentLimits.count)
      .default([]),
    cardId: z.uuid().nullable().default(null),
    threadId: z.union([roleIdSchema, z.literal('crew')]).optional(),
    // Omission uses the saved agent default; null explicitly uses the CLI default.
    reasoning: z.enum(reasoningLevels).nullable().optional(),
  })
  .refine(
    (input) => !!input.content || input.attachments.length > 0,
    'Write a message or attach a file.',
  )
  .refine(
    (input) =>
      input.attachments.reduce(
        (size, file) =>
          size +
          (file.data.length / 4) * 3 -
          (file.data.endsWith('==') ? 2 : file.data.endsWith('=') ? 1 : 0),
        0,
      ) <= chatAttachmentLimits.bytes,
    'Attachments must total 10 MB or less.',
  );
export const chatResultSchema = z.object({ reply: z.string().trim().min(1).max(12000) });
export type ChatResult = z.infer<typeof chatResultSchema>;
