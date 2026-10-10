import { z } from 'zod';

export const userQuestionInput = z
  .object({
    question: z.string().trim().min(1).max(2000),
    reason: z.string().trim().max(2000).default(''),
    continuationNotes: z.string().trim().max(8000).default(''),
    options: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          label: z.string().trim().min(1).max(200),
          description: z.string().trim().max(500).default(''),
        }),
      )
      .max(20)
      .default([]),
    multiSelect: z.boolean().default(false),
  })
  .refine(
    (input) => new Set(input.options.map((option) => option.id)).size === input.options.length,
    'Question option IDs must be unique.',
  );
export const userAnswerInput = z
  .object({
    selected: z.array(z.string().max(80)).max(20).default([]),
    text: z.string().trim().max(8000).default(''),
  })
  .refine(
    (input) => input.selected.length > 0 || !!input.text,
    'Choose an option or write an answer.',
  );
export interface UserInputRequest extends z.infer<typeof userQuestionInput> {
  id: string;
  threadId: string;
  sourceThreadId: string;
  roleId: string;
  runId: string;
  messageId: string;
  cardId: string | null;
  createdAt: string;
  status: 'pending' | 'answered' | 'cancelled';
  answer?: z.infer<typeof userAnswerInput>;
  answerMessageId?: string;
  answeredAt?: string;
  continuationRequestId?: string;
  cancellationReason?: string;
}
