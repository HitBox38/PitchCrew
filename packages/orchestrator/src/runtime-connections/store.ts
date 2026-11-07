import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { runtimeIds, type RuntimeId } from '@pitchcrew/core';
import { validateRuntimeConnectionValue } from '@pitchcrew/adapters';

const entrySchema = z
  .object({
    revision: z.string().uuid(),
    values: z.record(z.string().max(100), z.string().max(16_384)),
  })
  .strict();
const fileSchema = z
  .object({ version: z.literal(1), runtimes: z.partialRecord(z.enum(runtimeIds), entrySchema) })
  .strict();
type ConnectionFile = z.infer<typeof fileSchema>;
export class RuntimeConnectionConflict extends Error {
  constructor() {
    super('Authentication settings changed in another window. Reload them before saving.');
    this.name = 'RuntimeConnectionConflict';
  }
}
export class RuntimeConnectionReadError extends Error {
  constructor() {
    super(
      'Saved runtime credentials cannot be read. Recover authentication settings to keep a private backup and start again.',
    );
    this.name = 'RuntimeConnectionReadError';
  }
}

/** Write-only runtime secrets. Never expose file contents through a snapshot or diagnostic. */
export class RuntimeConnectionStore {
  readonly folder: string;
  readonly path: string;
  constructor(directory: string) {
    this.folder = join(directory, 'runtime-connections');
    this.path = join(this.folder, 'credentials.json');
  }
  private read = (): ConnectionFile => {
    try {
      if (lstatSync(this.folder).isSymbolicLink()) throw new Error();
      const info = lstatSync(this.path);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024) throw new Error();
      const state = fileSchema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
      for (const [runtime, entry] of Object.entries(state.runtimes)) {
        if (runtime === 'demo') throw new Error();
        for (const [name, value] of Object.entries(entry!.values))
          validateRuntimeConnectionValue(runtime as RuntimeId, name, value);
      }
      chmodSync(this.path, 0o600);
      return state;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return { version: 1, runtimes: {} };
      throw new RuntimeConnectionReadError();
    }
  };
  current = (runtime: RuntimeId) =>
    this.read().runtimes[runtime] ?? {
      revision: '00000000-0000-4000-8000-000000000000',
      values: {},
    };
  resetUnreadable = () => {
    try {
      this.read();
    } catch (error) {
      if (!(error instanceof RuntimeConnectionReadError)) throw error;
      const folder = lstatSync(this.folder),
        file = lstatSync(this.path);
      if (
        !folder.isDirectory() ||
        folder.isSymbolicLink() ||
        !file.isFile() ||
        file.isSymbolicLink() ||
        file.nlink !== 1
      )
        throw new Error(
          'The credentials path is unsafe. Restore the private file before changing authentication settings.',
        );
      const backup = `credentials.invalid-${randomUUID()}.json`;
      chmodSync(this.folder, 0o700);
      chmodSync(this.path, 0o600);
      renameSync(this.path, join(this.folder, backup));
      return { backup };
    }
    throw new Error('Saved authentication settings are readable. Recovery is not needed.');
  };
  save = (runtime: RuntimeId, values: Record<string, string>, revision: string) => {
    const state = this.read();
    const previous = state.runtimes[runtime]?.revision ?? '00000000-0000-4000-8000-000000000000';
    if (previous !== revision) throw new RuntimeConnectionConflict();
    if (runtime === 'demo') throw new Error('Authentication settings require a real runtime.');
    for (const [name, value] of Object.entries(values))
      validateRuntimeConnectionValue(runtime, name, value);
    state.runtimes[runtime] = { revision: randomUUID(), values: { ...values } };
    const source = JSON.stringify(state);
    if (Buffer.byteLength(source) > 1024 * 1024)
      throw new Error('Runtime authentication settings exceed the storage limit.');
    const temporary = join(this.folder, `${randomUUID()}.tmp`);
    try {
      mkdirSync(this.folder, { recursive: true, mode: 0o700 });
      if (!lstatSync(this.folder).isDirectory() || lstatSync(this.folder).isSymbolicLink())
        throw new Error();
      chmodSync(this.folder, 0o700);
      writeFileSync(temporary, source, { mode: 0o600, flag: 'wx' });
      chmodSync(temporary, 0o600);
      renameSync(temporary, this.path);
    } catch {
      throw new Error(
        'Runtime credentials could not be saved. Check workspace storage and try again.',
      );
    } finally {
      try {
        rmSync(temporary, { force: true });
      } catch {
        /* Private cleanup cannot turn a committed save into a reported failure. */
      }
    }
    return state.runtimes[runtime]!;
  };
}
