import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { runtimeIds, type RuntimeId } from '@pitchcrew/core';

const executable = z
  .string()
  .min(1)
  .max(4096)
  .refine(isAbsolute)
  .refine((value) => !/[\r\n\0]/.test(value));
const schema = z.object({
  version: z.literal(1),
  paths: z.partialRecord(
    z.enum(runtimeIds),
    z.object({ path: executable, source: z.enum(['custom', 'managed']) }),
  ),
  operations: z.partialRecord(
    z.enum(runtimeIds),
    z.object({
      id: z.uuid(),
      stage: z.enum([
        'preparing',
        'installing',
        'verifying',
        'succeeded',
        'failed',
        'cancelled',
        'interrupted',
      ]),
      startedAt: z.iso.datetime(),
      finishedAt: z.iso.datetime().nullable(),
      detail: z.string().max(2000),
      output: z.string().max(16000),
    }),
  ),
});

/** Paths and bounded non-secret installer outcomes, outside board events and snapshots. */
export class RuntimeSetupStore {
  readonly path: string;
  state: z.infer<typeof schema> = { version: 1, paths: {}, operations: {} };
  constructor(directory: string) {
    this.path = join(directory, 'runtime-setup.json');
    if (existsSync(this.path))
      this.state = schema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
    for (const operation of Object.values(this.state.operations)) {
      if (!operation || operation.finishedAt) continue;
      operation.stage = 'interrupted';
      operation.finishedAt = new Date().toISOString();
      operation.detail =
        'Setup was interrupted. Recheck the installation before retrying; it was not adopted.';
    }
  }
  paths = (): Partial<Record<RuntimeId, string>> =>
    Object.fromEntries(
      Object.entries(this.state.paths)
        .filter(([id]) => id !== 'demo')
        .map(([id, entry]) => [id, entry!.path]),
    );
  save = () => {
    const text = JSON.stringify(schema.parse(this.state)) + '\n';
    writeFileSync(`${this.path}.tmp`, text, { mode: 0o600 });
    renameSync(`${this.path}.tmp`, this.path);
  };
}
