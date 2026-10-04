import type { ConnectorStatus } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { storeSchema } from './helpers.ts';
import type { ConnectorManagerContext } from './types.ts';

export async function initialize(this: ConnectorManagerContext): Promise<void> {
  await mkdir(this.folder, { recursive: true, mode: 0o700 });
  await chmod(this.folder, 0o700);
  try {
    this.store = storeSchema.parse(JSON.parse(await readFile(this.file, 'utf8')));
    await chmod(this.file, 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new Error(
        'Cannot read connector credentials. Restore or remove the connectors/credentials.json file in your data directory.',
      );
  }
}
export function save(this: ConnectorManagerContext): Promise<void> {
  const contents = JSON.stringify(this.store);
  // Serialize atomic replacements so a refresh cannot overwrite a disconnect.
  const save = this.saving
    .catch(() => {})
    .then(async () => {
      const temporary = join(this.folder, `${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, contents, { mode: 0o600, flag: 'wx' });
        await rename(temporary, this.file);
        await chmod(this.file, 0o600);
      } finally {
        await rm(temporary, { force: true });
      }
    });
  this.saving = save;
  return save;
}
export async function disconnect(
  this: ConnectorManagerContext,
  provider: 'github' | 'google',
): Promise<ConnectorStatus[]> {
  this.lifetimes[provider].abort();
  this.lifetimes[provider] = new AbortController();
  if (provider === 'google') this.cancelPending();
  if (provider === 'github') this.githubCliState = undefined;
  delete this.store[provider];
  this.errors[provider] = '';
  await this.save();
  return this.status();
}
export async function close(this: ConnectorManagerContext): Promise<void> {
  this.cancelPending();
  this.lifetimes.github.abort();
  this.lifetimes.google.abort();
  await this.saving;
}
