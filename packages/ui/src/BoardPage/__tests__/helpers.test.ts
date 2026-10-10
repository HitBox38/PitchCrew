import type { Approval, Card, Role, Run, Snapshot } from '@pitchcrew/core';
import { states, transitions } from '@pitchcrew/core/states';
import { describe, expect, it } from 'vitest';
import { stages } from '../../board-stages.ts';
import { canDragJob, pipelineDrop } from '../helpers.ts';

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
const writer = {
  id: 'custom-writer',
  name: 'My Writer',
  workflow: 'writer',
  enabled: true,
  runtime: 'demo',
} as Role;
const data = {
  roles: [writer],
  profile: [{ name: 'notes.md', content: 'Profile notes' }],
  runs: [],
  approvals: [],
  runtimes: [{ id: 'demo', available: true }],
} as unknown as Snapshot;
function drop(state: Card['state'], stage: string, snapshot = data) {
  return pipelineDrop(
    { ...card, state },
    stages.find((item) => item.id === stage)!,
    snapshot,
  );
}

describe('pipeline drops', () => {
  it('shortlists leads and starts a configured Writer through the run endpoint semantics', () => {
    expect(drop('lead', 'shortlisted')).toMatchObject({ kind: 'move', state: 'shortlisted' });
    expect(drop('shortlisted', 'drafts')).toEqual({
      kind: 'run',
      roleId: writer.id,
      label: 'Drop to start My Writer',
    });
    expect(drop('shortlisted', 'ready').kind).toBe('blocked');
    expect(drop('lead', 'drafts').kind).toBe('blocked');
  });
  it('requests changes from either Ready state without pretending to finish a review', () => {
    for (const state of ['agreed', 'awaiting_approval'] as const)
      expect(drop(state, 'drafts')).toMatchObject({ kind: 'move', state: 'changes_requested' });
    expect(drop('in_review', 'ready').kind).toBe('blocked');
  });
  it('never offers an invalid state transition or manual entry into a crew-owned state', () => {
    for (const state of states)
      for (const stage of stages) {
        const result = drop(state, stage.id);
        if (result.kind === 'move') {
          expect(transitions[state]).toContain(result.state);
          expect(['drafting', 'in_review', 'agreed', 'awaiting_approval']).not.toContain(
            result.state,
          );
          expect(stage.states).toContain(result.state);
        }
      }
  });
  it('blocks work on cards claimed by either a workflow or an attached chat', () => {
    expect(canDragJob({ ...card, owner: 'scout' }, data)).toBe(false);
    const busy = { ...data, runs: [{ cardId: card.id, status: 'running' } as Run] };
    expect(canDragJob(card, busy)).toBe(false);
  });
  it('requires profile notes and an enabled, installed, idle Writer', () => {
    for (const snapshot of [
      { ...data, profile: [{ name: 'notes.md', content: '  ' }] },
      { ...data, roles: [{ ...writer, enabled: false }] },
      { ...data, roles: [{ ...writer, retiredAt: 'today' }] },
      { ...data, runtimes: [] },
      { ...data, runs: [{ roleId: writer.id, status: 'running' } as Run] },
    ])
      expect(drop('shortlisted', 'drafts', snapshot).kind).toBe('blocked');
    const second = { ...writer, id: 'other-writer' };
    expect(
      drop('shortlisted', 'drafts', {
        ...data,
        roles: [writer, second],
        runs: [{ roleId: writer.id, status: 'running' } as Run],
      }),
    ).toMatchObject({ kind: 'run', roleId: second.id });
  });
  it('records submission only for an exported approval of the exact current packet', () => {
    const packet = {
      resume: 'Resume',
      coverLetter: 'Letter',
      formAnswers: '',
      note: '',
      claims: [],
    };
    const ready: Card = { ...card, state: 'awaiting_approval', packet };
    const stage = stages.find((item) => item.id === 'applied')!;
    const approval: Approval = {
      id: 'approval',
      action: 'export_packet',
      digest: 'fixture-digest',
      createdAt: '',
      decidedAt: null,
      cardId: card.id,
      status: 'consumed',
      exportDirectory: '/fixture/export',
      packet,
    };
    expect(pipelineDrop(ready, stage, { ...data, approvals: [approval] })).toMatchObject({
      kind: 'move',
      state: 'submitted',
    });
    for (const approvals of [
      [],
      [{ ...approval, status: 'approved' } as Approval],
      [{ ...approval, exportDirectory: undefined }],
      [{ ...approval, cardId: 'another-job' }],
      [{ ...approval, packet: { ...packet, resume: 'An old resume' } }],
    ])
      expect(pipelineDrop(ready, stage, { ...data, approvals }).kind).toBe('blocked');
    expect(canDragJob({ ...card, state: 'submitted' }, data)).toBe(false);
  });
});
