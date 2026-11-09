import type { Card, Role, Snapshot } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { missingSeats, scriptedSeats, setupProgress } from '../helpers.ts';

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
  it('labels seats ready only through the scripted Demo runtime without changing readiness', () => {
    const demo = {
      ...data,
      roles: roles.map((role) => ({ ...role, runtime: 'demo' as const })),
      runtimes: [...data.runtimes, { id: 'demo', available: true }],
    } as Snapshot;
    expect(setupProgress(demo).crew).toBe(true);
    expect(scriptedSeats(demo)).toEqual(['Scout', 'Writer', 'Reviewer']);
    expect(scriptedSeats(data)).toEqual([]);
    const mixed = { ...demo, roles: [...demo.roles, roles[1]] } as Snapshot;
    expect(scriptedSeats(mixed)).toEqual(['Scout', 'Reviewer']);
  });
  it('keeps paused or unavailable Demo agents out of readiness, as in production', () => {
    const production = {
      ...data,
      roles: roles.map((role) => ({ ...role, runtime: 'demo' as const, enabled: false })),
      runtimes: [...data.runtimes, { id: 'demo', available: false }],
    } as Snapshot;
    expect(setupProgress(production).crew).toBe(false);
    expect(missingSeats(production)).toEqual(['Scout', 'Writer', 'Reviewer']);
    expect(scriptedSeats(production)).toEqual([]);
  });
});
