import type { Approval } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { packetIntro } from '../helpers.ts';

const approval = (status: Approval['status']) => ({ status }) as Approval;

it('describes the packet by its approval state instead of always asking for approval', () => {
  expect(packetIntro(approval('pending'), true)).toContain('then approve the packet');
  expect(packetIntro(approval('approved'), true)).toContain('You approved this packet');
  expect(packetIntro(approval('consumed'), false)).not.toContain('approve');
  expect(packetIntro(approval('rejected'), false)).not.toContain('approve');
});
