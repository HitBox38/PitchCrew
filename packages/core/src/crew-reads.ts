import { z } from 'zod';

export const readFieldQuery = z.object({
  field: z
    .string()
    .max(160)
    .regex(/^[a-zA-Z]\w*(?:\.(?:[a-zA-Z]\w*|\d+))*$/)
    .optional()
    .describe('Field path, e.g. applicationContext.requirements.0.question.'),
  cursor: z
    .string()
    .regex(/^[\da-f]{64}:\d{1,12}$/)
    .optional()
    .describe('Use nextCursor with the same field to continue a long value.'),
});

export const historyReadQuery = readFieldQuery.extend({
  eventId: z.number().int().positive().optional().describe('Read one event from this card by ID.'),
  beforeEventId: z.number().int().positive().optional().describe('Exclusive event list cursor.'),
  limit: z.number().int().min(1).max(200).default(100).describe('Maximum events per page.'),
});

export const messagePageQuery = z.object({
  beforeId: z.string().min(1).max(128).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const conversationReadQuery = readFieldQuery.extend({
  ...messagePageQuery.shape,
  conversationId: z.string().min(1).max(128),
  messageId: z.string().min(1).max(128).optional(),
});
