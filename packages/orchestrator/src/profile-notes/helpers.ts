import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

export const noteNameSchema = z
  .string()
  .max(100)
  .regex(/^[\w.-]+\.md$/, 'Use a simple Markdown filename.')
  .refine((name) => !name.includes('..'), 'Use a simple Markdown filename.');

export const contentDigest = (content: string) =>
  createHash('sha256').update(content, 'utf8').digest('hex');

export const notFound = (message: string) => Object.assign(new Error(message), { statusCode: 404 });

/** A rejected save: the client receives the note's current content to merge or overwrite. */
export class ProfileConflictError extends Error {
  readonly statusCode = 409;
  constructor(readonly current: string | null) {
    super('This note changed on disk since you opened it.');
  }
}

export const noteFolder = (directory: string) => join(directory, 'profile');

/** Exact-case listing: case-insensitive filesystems still need the stored spelling. */
export const noteExists = async (directory: string, name: string) =>
  (await readdir(noteFolder(directory)).catch(() => [] as string[])).includes(name);

export const readNote = async (directory: string, name: string): Promise<string | null> => {
  if (!(await noteExists(directory, name))) return null;
  return readFile(join(noteFolder(directory), name), 'utf8');
};

/** Another file answering to this name, including a different-case file on a case-insensitive disk. */
export const occupiedBy = async (directory: string, name: string) => {
  try {
    const info = await stat(join(noteFolder(directory), name));
    return { dev: info.dev, ino: info.ino };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};
