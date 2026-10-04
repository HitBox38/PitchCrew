import type { Card, Role, Snapshot } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { setupProgress } from '../helpers.ts';

const roles: Role[] = (['scout', 'writer', 'reviewer'] as const).map((workflow) => ({
  id: `${workflow}-custom`,
  name: workflow,
  workflow,
  description: 'Fictional agent',
  runtime: 'codex',
  model: '',
  enabled: true,
  instructions: '',
}));
const data = {
  roles,
  runtimes: [{ id: 'codex', available: true }],
  profile: [],
  cards: [],
} as unknown as Snapshot;

describe('onboarding readiness', () => {
  it('requires saved, nonblank profile content and a real job, excluding demo cards', () => {
    expect(setupProgress(data)).toEqual({ profile: false, crew: true, job: false });
    expect(
      setupProgress({
        ...data,
        profile: [{ name: 'blank.md', content: '  \n' }],
        cards: [{ sample: true } as Card],
      }),
    ).toEqual({ profile: false, crew: true, job: false });
    expect(
      setupProgress({
        ...data,
        profile: [{ name: 'about.md', content: 'Fictional work history.' }],
        cards: [{ sample: false } as Card],
      }),
    ).toEqual({ profile: true, crew: true, job: true });
  });
  it('requires all three workflow seats, with enabled, available and nonretired agents', () => {
    for (const patch of [
      { enabled: false },
      { retiredAt: '2030-01-01' },
      { workflow: 'chat' as const },
      { runtime: 'claude-code' as const },
    ]) {
      expect(
        setupProgress({ ...data, roles: [roles[0], roles[1], { ...roles[2], ...patch }] }).crew,
      ).toBe(false);
    }
    expect(
      setupProgress({ ...data, runtimes: [{ ...data.runtimes[0], available: false }] }).crew,
    ).toBe(false);
  });
  it('supports legacy built-in seats without requiring specific custom role identities', () => {
    expect(
      setupProgress({
        ...data,
        roles: roles.map((role) => ({ ...role, id: role.workflow!, workflow: undefined })),
      }).crew,
    ).toBe(true);
  });
});
