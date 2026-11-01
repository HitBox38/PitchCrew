import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';
import { countedLabel, sidebarCounts } from '../helpers.ts';

const snapshot = (overrides: Partial<Snapshot> = {}) =>
  ({
    skills: [],
    proposals: [],
    skillProposals: [],
    instructionUpdates: [],
    profileProposals: [],
    ...overrides,
  }) as unknown as Snapshot;

describe('sidebar counts', () => {
  it('counts decisions, pending crew proposals and profile proposals awaiting review', () => {
    const data = snapshot({
      proposals: [{ status: 'pending' }, { status: 'applied' }],
      skillProposals: [{ status: 'pending' }, { status: 'rejected' }],
      profileProposals: [{ status: 'pending' }, { status: 'applying' }, { status: 'applied' }],
    } as unknown as Partial<Snapshot>);
    expect(sidebarCounts(data, 3)).toEqual({ inbox: 3, crew: 2, profile: 2, skills: 0 });
  });

  it('names a count only when something is waiting', () => {
    expect(countedLabel('Crew', 0, 'updates or proposals')).toBe('Crew');
    expect(countedLabel('Crew', 2, 'updates or proposals')).toBe('Crew, 2 updates or proposals');
  });
});
