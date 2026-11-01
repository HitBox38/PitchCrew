import { describe, expect, it } from 'vitest';
import type { Conversation, Role, Snapshot } from '@pitchcrew/core';
import { gmailTracker, trackerConversation, trackerDraft } from '../submission-follow-up.ts';

const role = (id: string, patch: Partial<Role> = {}) =>
  ({
    id,
    name: id === 'tracker' ? 'Tracker' : 'Helper',
    enabled: true,
    capabilities: { trackApplications: true, gmail: true },
    ...patch,
  }) as Role;
const google = (patch: Partial<Snapshot['connectors'][number]> = {}) =>
  ({
    id: 'google',
    connected: true,
    services: ['gmail'],
    ...patch,
  }) as Snapshot['connectors'][number];
const conversation = (id: string, patch: Partial<Conversation> = {}) =>
  ({
    id,
    kind: 'direct',
    participants: ['tracker'],
    cardId: 'card',
    archived: false,
    ...patch,
  }) as Conversation;

describe('Gmail tracker for an uncertain submission', () => {
  it('prefers the seeded Tracker among eligible agents', () => {
    expect(
      gmailTracker({ roles: [role('helper'), role('tracker')], connectors: [google()] })?.id,
    ).toBe('tracker');
  });
  it('requires an enabled, unretired agent with tracking and Gmail plus a Gmail account', () => {
    const roles = [
      role('tracker', { enabled: false }),
      role('a', { retiredAt: '2026-01-01' }),
      role('b', { capabilities: { gmail: true } as Role['capabilities'] }),
      role('c', { capabilities: { trackApplications: true } as Role['capabilities'] }),
    ];
    expect(gmailTracker({ roles, connectors: [google()] })).toBeUndefined();
    expect(gmailTracker({ roles: [role('tracker')], connectors: [] })).toBeUndefined();
    expect(
      gmailTracker({ roles: [role('tracker')], connectors: [google({ connected: false })] }),
    ).toBeUndefined();
    expect(
      gmailTracker({ roles: [role('tracker')], connectors: [google({ services: ['drive'] })] }),
    ).toBeUndefined();
  });
});

describe('conversation for the Gmail check', () => {
  const card = { id: 'card' };
  it('uses this conversation when the tracker is a member', () => {
    const current = conversation('here', { participants: ['submitter', 'tracker'] });
    expect(trackerConversation([current], current, card, 'tracker')).toEqual({ kind: 'current' });
  });
  it('reuses a writable job conversation with the tracker, else creates one', () => {
    const current = conversation('here', { participants: ['submitter'] });
    const items = [
      conversation('archived', { archived: true }),
      conversation('dm', { kind: 'agent_dm' }),
      conversation('other-job', { cardId: 'other' }),
      conversation('job'),
    ];
    expect(trackerConversation(items, current, card, 'tracker')).toEqual({
      kind: 'existing',
      id: 'job',
      participants: ['tracker'],
    });
    expect(trackerConversation(items.slice(0, 3), current, card, 'tracker')).toEqual({
      kind: 'create',
    });
  });
  it('addresses the tracker only in groups', () => {
    const job = { company: 'Waypoint', title: 'Senior UI Engineer' };
    expect(trackerDraft(job, 'tracker', ['tracker'])).toBe(
      'Check Gmail for a confirmation of the Waypoint Senior UI Engineer application.',
    );
    expect(trackerDraft(job, 'tracker', ['submitter', 'tracker'])).toMatch(/^@tracker Check/);
  });
});
