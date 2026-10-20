import type { ConnectorStatus } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { storeSchema } from './helpers.ts';
import type { ConnectorManagerContext } from './types.ts';

export const initialize = async (context: ConnectorManagerContext): Promise<void> => {
  await mkdir(context.folder, { recursive: true, mode: 0o700 });
  await chmod(context.folder, 0o700);
  try {
    context.store = storeSchema.parse(JSON.parse(await readFile(context.file, 'utf8')));
    await chmod(context.file, 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new Error(
        'Cannot read connector credentials. Restore or remove the connectors/credentials.json file in your data directory.',
      );
  }
};
export const save = (context: ConnectorManagerContext): Promise<void> => {
  const contents = JSON.stringify(context.store);
  // Serialize atomic replacements so a refresh cannot overwrite a disconnect.
  const save = context.saving
    .catch(() => {})
    .then(async () => {
      const temporary = join(context.folder, `${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, contents, { mode: 0o600, flag: 'wx' });
        await rename(temporary, context.file);
        await chmod(context.file, 0o600);
      } finally {
        await rm(temporary, { force: true });
      }
    });
  context.saving = save;
  return save;
};
export const disconnect = async (
  context: ConnectorManagerContext,
  provider: 'github' | 'google',
): Promise<ConnectorStatus[]> => {
  context.lifetimes[provider].abort();
  context.lifetimes[provider] = new AbortController();
  if (provider === 'google') {
    context.cancelPending();
    context.googleCliState = undefined;
  }
  if (provider === 'github') context.githubCliState = undefined;
  delete context.store[provider];
  context.errors[provider] = '';
  await context.save();
  return context.status();
};
export const close = async (context: ConnectorManagerContext): Promise<void> => {
  context.cancelPending();
  context.lifetimes.github.abort();
  context.lifetimes.google.abort();
  await context.saving;
};
