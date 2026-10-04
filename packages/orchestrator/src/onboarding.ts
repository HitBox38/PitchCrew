import type { OnboardingState } from '@pitchcrew/core';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const stateSchema = z
  .object({
    version: z.literal(1),
    status: z.enum(['welcome', 'setup', 'dismissed', 'completed']),
    step: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();

/** Small, atomic local preference writes also serialize concurrent renderer decisions. */
export class OnboardingPreferences {
  private readonly path: string;
  private state: OnboardingState;

  constructor(directory: string) {
    this.path = join(directory, 'onboarding.json');
    if (existsSync(this.path)) {
      this.state = stateSchema.parse(JSON.parse(readFileSync(this.path, 'utf8')));
    } else {
      // Existing workspaces remain undisturbed when upgrading to onboarding.
      this.state = {
        version: 1,
        status: existsSync(join(directory, 'pitchcrew.db')) ? 'dismissed' : 'welcome',
        step: 0,
      };
      this.save(this.state);
    }
  }

  get(): OnboardingState {
    return { ...this.state };
  }

  save(input: unknown): OnboardingState {
    const state = stateSchema.parse(input);
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    renameSync(temporary, this.path);
    this.state = state;
    return this.get();
  }
}
