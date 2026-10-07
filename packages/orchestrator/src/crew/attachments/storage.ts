import {
  chatAttachmentLimits,
  chatAttachmentMime,
  type ChatAttachment,
  type ChatAttachmentUpload,
  type ChatMessage,
  type ChatContext,
} from '@pitchcrew/core';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const attachmentPath = (directory: string, id: string) =>
  join(directory, 'chat-attachments', z.uuid().parse(id));

export async function removeAttachments(directory: string, files: ChatAttachment[]) {
  await Promise.all(files.map((file) => rm(attachmentPath(directory, file.id), { force: true })));
}

/** Persist only validated bytes under server-generated IDs, never user-supplied paths. */
export async function saveAttachments(directory: string, uploads: ChatAttachmentUpload[]) {
  const files: ChatAttachment[] = [];
  try {
    if (uploads.length)
      await mkdir(join(directory, 'chat-attachments'), { recursive: true, mode: 0o700 });
    for (const upload of uploads) {
      const bytes = Buffer.from(upload.data, 'base64');
      if (bytes.toString('base64') !== upload.data) throw new Error('Invalid attachment encoding.');
      const file: ChatAttachment = {
        id: randomUUID(),
        name: upload.name,
        mimeType: chatAttachmentMime(upload.name)!,
        size: bytes.length,
        sha256: digest(bytes),
      };
      files.push(file);
      await writeFile(attachmentPath(directory, file.id), bytes, { flag: 'wx', mode: 0o600 });
    }
    return files;
  } catch (error) {
    await removeAttachments(directory, files);
    throw error;
  }
}

export async function readAttachment(directory: string, file: ChatAttachment) {
  const path = attachmentPath(directory, file.id);
  if ((await stat(path)).size > chatAttachmentLimits.bytes)
    throw new Error('Attachment is too large.');
  const bytes = await readFile(path);
  if (bytes.length !== file.size || digest(bytes) !== file.sha256)
    throw new Error('Attachment contents changed.');
  return bytes;
}

export async function prepareAttachments(
  directory: string,
  runDirectory: string,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<NonNullable<ChatContext['attachments']>> {
  const files: NonNullable<ChatContext['attachments']> = [];
  for (const message of messages)
    for (const file of message.attachments ?? []) {
      signal.throwIfAborted();
      const folder = join(runDirectory, 'attachments', z.uuid().parse(file.id));
      await mkdir(folder, { recursive: true, mode: 0o700 });
      const path = join(folder, file.name);
      if (!chatAttachmentMime(file.name)) throw new Error('Invalid attachment filename.');
      await writeFile(path, await readAttachment(directory, file), { mode: 0o600 });
      files.push({ ...file, messageId: message.id, path });
    }
  signal.throwIfAborted();
  return files;
}
