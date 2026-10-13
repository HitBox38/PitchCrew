import type { Card, Run, Snapshot } from '@pitchcrew/core';
import { states } from '@pitchcrew/core/states';
import { describe, expect, it } from 'vitest';
import { dropStages } from '../../board-stages.ts';
import { canDragJob, pipelineDrop, statusDrop } from '../helpers.ts';

const card: Card = {
  id: 'job',
  company: 'Example',
  title: 'Engineer',
  location: 'Remote',
  url: '',
  salary: '',
  description: '',
  tags: [],
  state: 'lead',
  owner: null,
  packet: null,
  feedback: [],
  fit: null,
  createdAt: '',
  updatedAt: '',
  sample: false,
};
const data = {
  runs: [],
  roles: [],
  profile: [],
  approvals: [],
  runtimes: [],
} as unknown as Snapshot;

describe('manual status drops', () => {
  it('offers every different status from every status without a runtime, profile or packet', () => {
    for (const from of states) {
      const source = { ...card, state: from };
      expect(canDragJob(source, data)).toBe(true);
      for (const to of states)
        expect(statusDrop(source, to, data)).toMatchObject(
          from === to ? { kind: 'blocked' } : { kind: 'move', state: to },
        );
    }
  });
  it('covers all statuses once, including closed statuses, and defaults columns to their first status', () => {
    expect(dropStages.flatMap((stage) => stage.states)).toEqual(states);
    for (const state of states)
      for (const stage of dropStages)
        expect(pipelineDrop({ ...card, state }, stage, data)).toMatchObject(
          stage.states.includes(state)
            ? { kind: 'blocked' }
            : { kind: 'move', state: stage.states[0] },
        );
  });
  it('blocks cards claimed by workflow runs or attached chat runs', () => {
    for (const mode of ['workflow', 'chat']) {
      const busy = { ...data, runs: [{ cardId: card.id, status: 'running', mode } as Run] };
      expect(canDragJob(card, busy)).toBe(false);
      for (const state of states) expect(statusDrop(card, state, busy).kind).toBe('blocked');
    }
    expect(canDragJob({ ...card, owner: 'scout' }, data)).toBe(false);
    expect(
      canDragJob(card, { ...data, runs: [{ cardId: 'other', status: 'running' } as Run] }),
    ).toBe(true);
    expect(
      canDragJob(card, { ...data, runs: [{ cardId: card.id, status: 'completed' } as Run] }),
    ).toBe(true);
  });
});
