import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { noteNameSchema } from './helpers.ts';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const metaSchema = z
  .object({
    name: noteNameSchema,
    deletedAt: z.iso.datetime(),
    folder: z.string().max(500).optional(),
  })
  .strict();
export type TrashMeta = z.infer<typeof metaSchema>;

const trashDirectory = (directory: string) => join(directory, 'profile-trash');

/** Deleted notes wait here so the user can undo; they are never profile evidence. */
export const moveToTrash = async (directory: string, id: string, meta: TrashMeta) => {
  const entry = join(trashDirectory(directory), id);
  await mkdir(entry, { recursive: true, mode: 0o700 });
  try {
    await writeFile(join(entry, 'meta.json'), `${JSON.stringify(meta)}\n`, { mode: 0o600 });
    await rename(join(directory, 'profile', meta.name), join(entry, meta.name));
  } catch (error) {
    await rm(entry, { recursive: true, force: true });
    throw error;
  }
};

export const readTrash = async (directory: string, id: string) => {
  const entry = join(trashDirectory(directory), id);
  try {
    const meta = metaSchema.parse(JSON.parse(await readFile(join(entry, 'meta.json'), 'utf8')));
    return { entry, meta, file: join(entry, meta.name) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw Object.assign(new Error('This note is no longer in the trash.'), { statusCode: 404 });
    throw error;
  }
};

/** Opportunistic cleanup; unreadable entries are left alone rather than guessed at. */
export const pruneTrash = async (directory: string, now = Date.now()) => {
  const root = trashDirectory(directory);
  const entries = await readdir(root).catch(() => []);
  await Promise.all(
    entries.map(async (id) => {
      try {
        const meta = metaSchema.parse(
          JSON.parse(await readFile(join(root, id, 'meta.json'), 'utf8')),
        );
        if (now - Date.parse(meta.deletedAt) > RETENTION_MS)
          await rm(join(root, id), { recursive: true, force: true });
      } catch {
        // Keep entries this version cannot read.
      }
    }),
  );
};

/** Notes waiting in the trash, newest first; entries this version cannot read are skipped. */
export const listTrash = async (directory: string) => {
  const root = trashDirectory(directory);
  const entries = await readdir(root).catch(() => [] as string[]);
  const listed = await Promise.all(
    entries.map(async (id) => {
      try {
        const meta = metaSchema.parse(
          JSON.parse(await readFile(join(root, id, 'meta.json'), 'utf8')),
        );
        return [{ trashId: id, name: meta.name, deletedAt: meta.deletedAt }];
      } catch {
        return [];
      }
    }),
  );
  return listed.flat().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
};
