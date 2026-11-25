import { describe, expect, it } from 'vitest';
import { attentionItems } from '../../lib/attention.ts';
import {
  ago,
  everyKind,
  everyKindRemote,
  profileProposal,
  roleProposal,
  skillProposal,
  snapshot,
} from '../../lib/__tests__/attention-fixture.ts';
import { countedLabel, sidebarCounts } from '../helpers.ts';

describe('sidebar counts', () => {
  it('counts every attention item on Home and its own kinds on Crew, Profile and Skills', () => {
    const items = attentionItems(everyKind(), { remoteRequests: everyKindRemote });
    expect(items).toHaveLength(17);
    // Crew: instruction update and role and skill proposals; Profile: an update to review and
    // one to recover; Skills: one upstream update. Home counts all of them with the rest.
    expect(sidebarCounts(items)).toEqual({ home: 17, crew: 3, profile: 2, skills: 1 });
  });

  it('counts only proposals still waiting, and a Profile update being applied', () => {
    const data = snapshot({
      proposals: [roleProposal('waiting'), roleProposal('applied', { status: 'applied' })],
      skillProposals: [skillProposal('waiting'), skillProposal('declined', { status: 'rejected' })],
      profileProposals: [
        profileProposal('pending'),
        profileProposal('applying', { status: 'applying', decidedAt: ago(30) }),
        profileProposal('applied', { status: 'applied' }),
      ],
    });
    expect(sidebarCounts(attentionItems(data))).toEqual({
      home: 4,
      crew: 2,
      profile: 2,
      skills: 0,
    });
  });

  it('names a count only when something is waiting', () => {
    expect(countedLabel('Crew', 0, 'updates or proposals')).toBe('Crew');
    expect(countedLabel('Crew', 2, 'updates or proposals')).toBe('Crew, 2 updates or proposals');
    expect(countedLabel('Home', 6, 'waiting on you')).toBe('Home, 6 waiting on you');
  });
});
