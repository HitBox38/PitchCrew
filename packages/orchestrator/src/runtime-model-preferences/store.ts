import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, statSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { z } from 'zod';
import {
  defaultRuntimeModelPreferences,
  runtimeIds,
  runtimeModelPreferencesSchema,
  type RuntimeId,
  type RuntimeModelPreferences,
} from '@pitchcrew/core';

const fileSchema = z
  .object({
    version: z.literal(1),
    runtimes: z.partialRecord(z.enum(runtimeIds), runtimeModelPreferencesSchema),
  })
  .strict();
type FileState = z.infer<typeof fileSchema>;
const fingerprint = (preferences: RuntimeModelPreferences) =>
  createHash('sha256').update(JSON.stringify(preferences)).digest('hex');

export class RuntimeModelPreferencesReadError extends Error {
  constructor() {
    super(
      'Saved model choices cannot be read. Native models remain available; recover model choices in Settings > Runtimes to restore custom definitions and editing.',
    );
    this.name = 'RuntimeModelPreferencesReadError';
  }
}

/** User preferences only; never board events, runtime credentials or ambient CLI configuration. */
export class RuntimeModelPreferencesStore {
  readonly path: string;
  constructor(directory: string) {
    this.path = join(directory, 'runtime-model-preferences.json');
  }
  private read = (): FileState => {
    try {
      if (statSync(this.path).size > 1024 * 1024)
        throw new Error('Model preferences exceed the 1 MB limit.');
      return fileSchema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return { version: 1, runtimes: {} };
      throw new RuntimeModelPreferencesReadError();
    }
  };
  current = (id: RuntimeId) => {
    const preferences = this.read().runtimes[id] ?? defaultRuntimeModelPreferences();
    return { preferences, revision: fingerprint(preferences) };
  };
  resetUnreadable = () => {
    try {
      this.read();
    } catch {
      const backup = join(
        dirname(this.path),
        `runtime-model-preferences.invalid-${randomUUID()}.json`,
      );
      renameSync(this.path, backup);
      return { ok: true, backup: basename(backup) };
    }
    throw new Error('Saved model choices are readable. Recovery is not needed.');
  };
  save = (id: RuntimeId, preferences: RuntimeModelPreferences, revision: string) => {
    if (id === 'demo') throw new Error('Demo has no model preferences.');
    const state = this.read();
    const current = state.runtimes[id] ?? defaultRuntimeModelPreferences();
    if (fingerprint(current) !== revision)
      throw new Error('Model preferences changed elsewhere. Reload them before saving.');
    const parsed = runtimeModelPreferencesSchema.parse(preferences);
    state.runtimes[id] = parsed;
    const source = JSON.stringify(state, null, 2) + '\n';
    if (Buffer.byteLength(source) > 1024 * 1024)
      throw new Error('Model preferences exceed the 1 MB limit.');
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, source, { mode: 0o600 });
      renameSync(temporary, this.path);
    } finally {
      rmSync(temporary, { force: true });
    }
    return { preferences: parsed, revision: fingerprint(parsed) };
  };
}
