import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { runtimeIds } from '@pitchcrew/core';

const update = z.object({
  id: z.enum(runtimeIds),
  status: z.enum(['unchecked', 'current', 'available', 'unknown']),
  installedVersion: z.string().max(100),
  latestVersion: z.string().max(100).nullable(),
  checkedAt: z.iso.datetime().nullable(),
  lastSuccessAt: z.iso.datetime().nullable(),
  detail: z.string().max(1000),
  installer: z.string().max(100),
  canUpdate: z.boolean(),
  manualCommand: z.string().max(2000),
  operation: z
    .object({
      id: z.uuid(),
      stage: z.enum(['preparing', 'updating', 'verifying', 'succeeded', 'failed', 'interrupted']),
      startedAt: z.iso.datetime(),
      finishedAt: z.iso.datetime().nullable(),
      detail: z.string().max(1000),
      output: z.string().max(16000),
    })
    .optional(),
});
const schema = z.object({
  version: z.literal(1),
  automatic: z.boolean(),
  nextCheckAt: z.iso.datetime().nullable(),
  updates: z.array(update).max(13),
  running: z.record(z.string(), z.number().int().positive()).default({}),
  identities: z.record(z.string(), z.string().max(10_000)).default({}),
});
export class RuntimeMaintenanceStore {
  readonly path: string;
  state: z.infer<typeof schema> = {
    version: 1,
    automatic: true,
    nextCheckAt: null,
    updates: [],
    running: {},
    identities: {},
  };
  constructor(directory: string) {
    this.path = join(directory, 'runtime-maintenance.json');
    if (!existsSync(this.path)) return;
    try {
      this.state = schema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
    } catch {
      /* Rebuild invalid metadata on the next check. */
    }
  }
  save() {
    const state = schema.parse(this.state);
    writeFileSync(`${this.path}.tmp`, JSON.stringify(state) + '\n', { mode: 0o600 });
    renameSync(`${this.path}.tmp`, this.path);
  }
}
