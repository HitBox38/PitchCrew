import type { ChatMessage } from '@pitchcrew/core';
import { z } from 'zod';
import { readAttachment } from '../attachments/storage.ts';
import { readAttachmentText } from '../attachments/text.ts';
import type { CrewContext, RunCapability } from '../types.ts';

const reading = new WeakMap<CrewContext, Set<string>>();

export async function readChatAttachment(
  context: CrewContext,
  capability: RunCapability,
  token: string,
  data: unknown,
) {
  const input = z.object({ messageId: z.uuid(), attachmentId: z.uuid() }).parse(data);
  const message = context.board.get<ChatMessage>('message', input.messageId);
  if (message.threadId !== capability.roleId && message.threadId !== 'crew')
    throw new Error('This run cannot access another role’s chat attachments.');
  const file = message.attachments?.find((attachment) => attachment.id === input.attachmentId);
  if (!file) throw new Error('Attachment not found.');
  const signal = context.controllers.get(capability.runId)?.signal;
  if (!signal) throw new Error('Run capability is invalid or expired.');
  const pending = reading.get(context) ?? new Set<string>();
  reading.set(context, pending);
  if (pending.has(capability.runId) || pending.size >= 2)
    throw new Error('An attachment is being read. Try again when that read finishes.');
  pending.add(capability.runId);
  try {
    const bytes = await readAttachment(context.directory, file);
    const result = file.mimeType.startsWith('image/')
      ? { attachment: file, image: { data: bytes.toString('base64'), mimeType: file.mimeType } }
      : { attachment: file, ...(await readAttachmentText(bytes, file.mimeType, signal)) };
    if (
      context.capabilities.get(token) !== capability ||
      signal.aborted ||
      !context.board.get<import('@pitchcrew/core').Role>('role', capability.roleId).enabled
    )
      throw new Error('Run capability is invalid or expired.');
    return result;
  } finally {
    pending.delete(capability.runId);
  }
}
