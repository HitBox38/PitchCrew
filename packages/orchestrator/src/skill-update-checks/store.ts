import { skillSourceSchema, type SkillUpdateCheck } from '@pitchcrew/core';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const skillUpdateCheckSchema = z
  .object({
    skillId: z.uuid(),
    installed: skillSourceSchema,
    checkedAt: z.iso.datetime(),
    successfulAt: z.iso.datetime().optional(),
    error: z.string().max(500).optional(),
    latest: skillSourceSchema.optional(),
    detectedAt: z.iso.datetime().optional(),
    dismissedRevision: z.string().max(800).optional(),
  })
  .strict();

const schema = z
  .object({
    version: z.literal(1),
    automatic: z.boolean(),
    checks: z.array(skillUpdateCheckSchema).max(100),
  })
  .strict();

/** Maintenance state is not a skill change and belongs outside the event log. */
export class SkillUpdateStore {
  private readonly path: string;
  private state: z.infer<typeof schema> = { version: 1, automatic: true, checks: [] };

  constructor(directory: string) {
    this.path = join(directory, 'skill-updates.json');
    if (!existsSync(this.path)) return;
    try {
      this.state = schema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
    } catch {
      // An unreadable maintenance cache can be reconstructed by checking again.
    }
  }

  get = () => {
    return structuredClone(this.state);
  };

  automatic = (automatic: boolean) => {
    this.save({ ...this.state, automatic });
  };

  put = (check: SkillUpdateCheck) => {
    this.save({
      ...this.state,
      checks: [...this.state.checks.filter((item) => item.skillId !== check.skillId), check].slice(
        -100,
      ),
    });
  };

  private save = (state: z.infer<typeof schema>) => {
    const parsed = schema.parse(state);
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(parsed)}\n`, { mode: 0o600 });
    renameSync(temporary, this.path);
    this.state = parsed;
  };
}
