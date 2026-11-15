import type { ProfileSkippedFile, ProfileSourceInput } from '@pitchcrew/core';
import { createHash } from 'node:crypto';
import { z } from 'zod';
export const localName = (source: string, key: string, path: string) => {
  const label =
    path
      .replace(/\.[^./]+$/, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/\.{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(-60) || 'note';
  return `${label}-${digest(source + ':' + key).slice(0, 12)}.md`;
};
export const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid source response.');
  return value as Record<string, unknown>;
};
export const text = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Invalid source text.');
  return value;
};

// Leaves out documents a Profile note cannot hold, so one large file never blocks the rest.
export const checkFiles = (
  files: RemoteFile[],
  skipped: ProfileSkippedFile[],
  requireDocuments: boolean,
) => {
  if (
    files.length > MAX_FILES ||
    files.reduce((sum, file) => sum + file.content.length, 0) > MAX_CHARACTERS
  )
    throw new Error(
      'This source is too large. Choose a smaller folder (up to 100 documents and 1 million characters).',
    );
  const kept: RemoteFile[] = [];
  const all = [...skipped];
  for (const file of files) {
    const reason = file.content.includes('\0')
      ? 'not_text'
      : file.content.length > NOTE_CHARACTERS
        ? 'too_large'
        : null;
    if (reason) all.push({ key: file.key, path: file.path, reason });
    else kept.push(file);
  }
  if (requireDocuments && !kept.length)
    throw new Error(
      all.length
        ? 'None of these documents can be imported. Profile notes hold up to 50,000 characters of plain text; split larger files or choose another folder.'
        : 'No supported documents found. Choose a folder with Markdown, text files or Google Docs.',
    );
  return { files: kept, skipped: all };
};

const folderPath = z
  .string()
  .max(500)
  .refine(
    (path) =>
      !path.startsWith('/') &&
      !path.includes('\\') &&
      !path.split('/').some((part) => part === '.' || part === '..'),
    'Use a relative repository folder path.',
  );
export const sourceInput = z.discriminatedUnion('provider', [
  z
    .object({
      provider: z.literal('github'),
      repository: z
        .string()
        .regex(/^[\w.-]+\/[\w.-]+$/)
        .max(201)
        .refine((v) => !v.split('/').some((p) => p === '.' || p === '..')),
      path: folderPath,
      ref: z.string().min(1).max(200).optional(),
    })
    .strict(),
  z.object({ provider: z.literal('drive'), folderId: z.string().regex(/^[\w-]{1,200}$/) }).strict(),
]);
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export const sourceId = (input: ProfileSourceInput) => digest(JSON.stringify(input)).slice(0, 24);
export const MAX_FILES = 100;
export const MAX_FOLDERS = 30;
const MAX_CHARACTERS = 1000000;
// Matches the Profile note save limit.
const NOTE_CHARACTERS = 50000;
export interface RemoteFile {
  key: string;
  path: string;
  url: string;
  revision: string;
  content: string;
}
