import { defaultInstructionRevisionId, roleIdSchema } from '@pitchcrew/core';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const stateSchema = z
  .object({
    version: z.literal(1),
    dismissed: z.record(roleIdSchema, defaultInstructionRevisionId),
  })
  .strict();
type State = z.infer<typeof stateSchema>;

/**
 * "Keep mine" choices for default instruction updates, by role ID and the dismissed revision.
 * A local preference like onboarding.json: it changes no role, so it stays out of board events.
 */
export class InstructionUpdatePreferences {
  private readonly path: string;
  private state: State = { version: 1, dismissed: {} };

  constructor(directory: string) {
    this.path = join(directory, 'instruction-updates.json');
    if (!existsSync(this.path)) return;
    try {
      this.state = stateSchema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
    } catch {
      // An unreadable file only brings notices back; the next decision rewrites it.
    }
  }

  dismissed(): Record<string, string> {
    return { ...this.state.dismissed };
  }

  dismiss(roleId: string, revision: string): void {
    this.save({ version: 1, dismissed: { ...this.state.dismissed, [roleId]: revision } });
  }

  clear(roleId: string): void {
    if (!(roleId in this.state.dismissed)) return;
    const dismissed = { ...this.state.dismissed };
    delete dismissed[roleId];
    this.save({ version: 1, dismissed });
  }

  private save(input: State): void {
    const state = stateSchema.parse(input);
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    renameSync(temporary, this.path);
    this.state = state;
  }
}
