import type { ProfileFile, ProfileOrganization } from '@pitchcrew/core';
import { readProfile } from '@pitchcrew/packet';
import { randomUUID } from 'node:crypto';
import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { CrewContext } from '../crew/types.ts';
import { assertProfileReady, changeProfile } from '../profile-sources/mutation.ts';
import {
  ProfileConflictError,
  contentDigest,
  noteExists,
  noteFolder,
  noteNameSchema,
  notFound,
  occupiedBy,
  readNote,
} from './helpers.ts';
import { listTrash, moveToTrash, pruneTrash, readTrash } from './trash.ts';

export { ProfileConflictError } from './helpers.ts';

/** Undefined keeps unconditional saves; null expects a new note; a digest expects that content. */
export const checkBaseline = async (
  context: CrewContext,
  name: string,
  baseline: string | null | undefined,
) => {
  if (baseline === undefined) return;
  const current = await readNote(context.directory, name);
  // On case-insensitive disks "Race.md" would overwrite an existing "race.md".
  if (current === null && (await occupiedBy(context.directory, name)))
    throw new Error(
      'Another note already uses this name with different capitals. Rename this note.',
    );
  if ((current === null ? null : contentDigest(current)) !== baseline)
    throw new ProfileConflictError(current);
};

const renameOnDisk = async (directory: string, from: string, to: string) => {
  const folder = noteFolder(directory);
  const source = await occupiedBy(directory, from);
  const target = await occupiedBy(directory, to);
  if (target && (target.dev !== source?.dev || target.ino !== source.ino))
    throw new Error('A note with this name already exists. Choose another name.');
  if (!target) return rename(join(folder, from), join(folder, to));
  // Case-only rename on a case-insensitive disk: go through a name readProfile ignores.
  const intermediate = join(folder, `.${randomUUID()}.rename`);
  await rename(join(folder, from), intermediate);
  await rename(intermediate, join(folder, to));
};

export const renameProfileNote = async (
  context: CrewContext,
  input: unknown,
): Promise<{ profile: ProfileFile[]; organization: ProfileOrganization }> => {
  const { from, to } = z.object({ from: noteNameSchema, to: noteNameSchema }).strict().parse(input);
  assertProfileReady(context);
  return changeProfile(context, async () => {
    if (!(await noteExists(context.directory, from))) throw notFound('This note no longer exists.');
    if (from !== to) {
      if (await noteExists(context.directory, to))
        throw new Error('A note with this name already exists. Choose another name.');
      const undoSources = await context.profileSources.renameNote(from, to);
      try {
        await renameOnDisk(context.directory, from, to);
      } catch (error) {
        await undoSources();
        throw error;
      }
      try {
        context.profileOrganization.renameNote(from, to);
      } catch (error) {
        await renameOnDisk(context.directory, to, from);
        await undoSources();
        throw error;
      }
    }
    return {
      profile: await readProfile(context.directory),
      organization: context.profileOrganization.get(),
    };
  });
};

export const deleteProfileNote = async (
  context: CrewContext,
  value: unknown,
): Promise<{ trashId: string; profile: ProfileFile[] }> => {
  const name = noteNameSchema.parse(value);
  assertProfileReady(context);
  return changeProfile(context, async () => {
    if (!(await noteExists(context.directory, name))) throw notFound('This note no longer exists.');
    await pruneTrash(context.directory);
    const trashId = randomUUID();
    const folder = context.profileOrganization.get().locations[name];
    await moveToTrash(context.directory, trashId, {
      name,
      deletedAt: new Date().toISOString(),
      ...(folder === undefined ? {} : { folder }),
    });
    try {
      context.profileOrganization.placeNote(name, undefined);
    } catch (error) {
      const { entry, file } = await readTrash(context.directory, trashId);
      await rename(file, join(noteFolder(context.directory), name));
      await rm(entry, { recursive: true, force: true });
      throw error;
    }
    return { trashId, profile: await readProfile(context.directory) };
  });
};

export const restoreProfileNote = async (
  context: CrewContext,
  input: unknown,
): Promise<{ name: string; profile: ProfileFile[]; organization: ProfileOrganization }> => {
  const { trashId } = z.object({ trashId: z.uuid() }).strict().parse(input);
  assertProfileReady(context);
  return changeProfile(context, async () => {
    const { entry, meta, file } = await readTrash(context.directory, trashId);
    if (await occupiedBy(context.directory, meta.name))
      throw new Error(
        `A note named ${meta.name} already exists. Rename or delete it before restoring.`,
      );
    await rename(file, join(noteFolder(context.directory), meta.name));
    await rm(entry, { recursive: true, force: true });
    if (meta.folder !== undefined)
      try {
        context.profileOrganization.placeNote(meta.name, meta.folder);
      } catch {
        // A folder that can no longer be recreated leaves the note in its default place.
      }
    await pruneTrash(context.directory);
    return {
      name: meta.name,
      profile: await readProfile(context.directory),
      organization: context.profileOrganization.get(),
    };
  });
};

/** Deleted notes the user can still restore (the last 30 days). */
export const listProfileTrash = async (context: CrewContext) => {
  await pruneTrash(context.directory);
  return listTrash(context.directory);
};
