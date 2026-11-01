import type { Approval } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { packetConsequence } from '../helpers.ts';

const approval = (status: Approval['status'], submission?: Approval['submission']) =>
  ({ status, submission }) as Approval;

it('names the consequence of the decision the packet is waiting for', () => {
  expect(packetConsequence(approval('pending'), 'Waypoint', true)).toBe(
    'Approving freezes these exact files so you can export them. Nothing is sent to Waypoint.',
  );
  expect(packetConsequence(approval('approved'), 'Waypoint', true)).toContain('exports the files');
  expect(packetConsequence(approval('consumed', { method: 'manual' }), 'W', true)).toContain(
    'only after you have applied',
  );
  expect(packetConsequence(approval('consumed', { method: 'agent' }), 'W', true)).toBe('');
  expect(packetConsequence(approval('pending'), 'Waypoint', false)).toBe('');
});
