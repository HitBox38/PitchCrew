import type { ChatReference } from './chat-references.ts';
import type { WorkspaceMessages } from './chat-history.ts';
import type { Run } from './runs.ts';
import type { UserInputRequest } from './user-input.ts';
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
  userInput?: { id: string; kind: 'question' | 'answer' };
  notification?: 'message' | 'attention';
  attachments?: ChatAttachment[];
  memoryIds?: string[];
  references?: ChatReference[];
}
export interface ChatStreamState extends WorkspaceMessages {
  activityRuns?: Run[];
  userInputs?: UserInputRequest[];
  messages: ChatMessage[];
  streamingMessages: ChatMessage[];
}
export interface ChatStreamUpdate extends Partial<WorkspaceMessages> {
  /** Run snapshots merged by ID; initial connection includes saved turn activity. */
  activityRuns?: Run[];
  // Full streams send saved history; workspace streams send previews and history metadata.
  userInputs?: UserInputRequest[];
  messages?: ChatMessage[];
  streamingMessages: ChatMessage[];
}
export const chatReferenceInput = z
  .object({
    kind: z.enum(['agent', 'skill', 'action']),
    id: z.string().min(1).max(128),
    token: z.string().min(2).max(200),
    start: z.number().int().min(0).max(8000),
    end: z.number().int().min(1).max(8000),
    revision: z.string().max(100).optional(),
  })
  .strict();
export const chatInput = z
  .object({
    content: z.string().trim().max(8000).default(''),
    references: z.array(chatReferenceInput).max(32).optional(),
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
    threadId: z.union([roleIdSchema, z.literal('crew'), z.uuid()]).optional(),
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
export const chatResultSchema = z
  .object({ reply: z.string().trim().max(12000), silent: z.boolean().optional() })
  .refine((value) => !!value.reply || value.silent === true, 'Return a reply or explicit silence.');
export type ChatResult = z.infer<typeof chatResultSchema>;
