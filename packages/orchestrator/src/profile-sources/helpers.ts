import type { ProfileSourceInput } from '@pitchcrew/core';
import { createHash } from 'node:crypto';
import { z } from 'zod';

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
export function localName(source: string, key: string, path: string) {
  const label =
    path
      .replace(/\.[^./]+$/, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/\.{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(-60) || 'note';
  return `${label}-${digest(source + ':' + key).slice(0, 12)}.md`;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid source response.');
  return value as Record<string, unknown>;
}
export function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid source text.');
  return value;
}
export const MAX_FILES = 100;
export const MAX_FOLDERS = 30;
export const MAX_CHARACTERS = 1000000;
export interface RemoteFile {
  key: string;
  path: string;
  url: string;
  revision: string;
  content: string;
}
export function checkFiles(files: RemoteFile[]) {
  if (!files.length)
    throw new Error(
      'No supported documents found. Choose a folder with Markdown, text files or Google Docs.',
    );
  if (
    files.length > MAX_FILES ||
    files.reduce((sum, file) => sum + file.content.length, 0) > MAX_CHARACTERS
  )
    throw new Error(
      'This source is too large. Choose a smaller folder (up to 100 documents and 1 million characters).',
    );
  for (const file of files)
    if (file.content.length > 50000 || file.content.includes('\0'))
      throw new Error(
        `${file.path} is not supported text or exceeds 50,000 characters. Choose a smaller source folder.`,
      );
}
