import { expect, it } from 'vitest';
import type { Card, Run, WorkQueueView } from '@pitchcrew/core';
import { jobWorkState } from '../helpers.ts';
const card = { id: 'fictional', owner: null } as Card;
const queue = (
  state: WorkQueueView['state'],
  status: WorkQueueView['requests'][number]['deliveries'][number]['status'],
): WorkQueueView =>
  ({
    state,
    reason: 'Fixture reason',
    requests: [{ deliveries: [{ roleId: 'writer', status }] }],
  }) as WorkQueueView;
it('keeps the loader across the click, reserved setup and running stages', () => {
  const pending = { cardId: card.id, path: '/queue/actions', label: 'Starting agent…' };
  expect(jobWorkState(card, pending)).toMatchObject({ label: 'Starting agent…', spinning: true });
  expect(jobWorkState(card, undefined, queue('ready', 'running'))).toMatchObject({
    label: 'Starting agent…',
    spinning: true,
  });
  expect(jobWorkState(card, undefined, undefined, { roleId: 'writer' } as Run)).toMatchObject({
    label: 'Agent working…',
    spinning: true,
    roleId: 'writer',
  });
  expect(jobWorkState(card)).toMatchObject({ label: null, spinning: false });
});
it.each([
  ['ready', 'queued', 'Agent queued'],
  ['blocked', 'queued', 'Agent on hold'],
  ['paused', 'failed', 'Agent on hold'],
  ['waiting', 'waiting', 'Waiting for you'],
] as const)(
  'uses a resting state for %s work rather than an endless spinner',
  (state, status, label) => {
    expect(jobWorkState(card, undefined, queue(state, status))).toMatchObject({
      label,
      spinning: false,
      starting: true,
      reason: 'Fixture reason',
    });
  },
);
