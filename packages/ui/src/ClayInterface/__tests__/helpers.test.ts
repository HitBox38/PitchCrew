import { describe, expect, it } from 'vitest';
import {
  jobBeadTone,
  moveTone,
  participantStates,
  requestStatus,
  stateTone,
  statusTone,
  trackBeads,
  trackIndex,
} from '../helpers.ts';

describe('clay stage track', () => {
  it('places every open workflow state on one bead', () => {
    expect(trackIndex('lead')).toBe(0);
    expect(trackIndex('changes_requested')).toBe(2);
    expect(trackIndex('in_review')).toBe(3);
    expect(trackIndex('awaiting_approval')).toBe(4);
    expect(trackIndex('interviewing')).toBe(5);
  });

  it('marks earlier beads done and later beads untouched', () => {
    expect(trackBeads('in_review')).toEqual(['done', 'done', 'done', 'current', 'todo', 'todo']);
  });

  it('leaves closed jobs off the track', () => {
    expect(trackIndex('withdrawn')).toBeNull();
    expect(trackBeads('ghosted').every((bead) => bead === 'todo')).toBe(true);
  });
});

describe('job bead law', () => {
  it('never paints a resting stage plum', () => {
    expect(stateTone('lead')).toBeUndefined();
    expect(stateTone('shortlisted')).toBe('current');
    expect(stateTone('in_review')).toBe('current');
    expect(stateTone('agreed')).toBe('ochre');
    expect(stateTone('interviewing')).toBe('moss');
    expect(stateTone('rejected')).toBeUndefined();
  });

  it('uses plum only while an agent works and ochre when the user is asked', () => {
    expect(jobBeadTone('drafting', { working: true })).toBe('plum');
    expect(jobBeadTone('drafting', { working: true, asks: true })).toBe('ochre');
    expect(jobBeadTone('drafting', {})).toBe('current');
  });

  it('marks recorded moves as completed steps or positive outcomes', () => {
    expect(moveTone('drafting')).toBe('done');
    expect(moveTone('submitted')).toBe('moss');
  });
});

describe('clay turn beads', () => {
  it('colours finished, waiting and failed steps and leaves stopped ones hollow', () => {
    expect(statusTone('completed')).toBe('done');
    expect(statusTone('waiting')).toBe('ochre');
    expect(statusTone('failed')).toBe('rose');
    expect(statusTone('cancelled')).toBeUndefined();
    expect(statusTone('interrupted')).toBeUndefined();
  });

  it('shows the most pressing delivery of a queued request', () => {
    expect(requestStatus(['completed', 'failed', 'queued'])).toBe('failed');
    expect(requestStatus(['queued', 'paused'])).toBe('paused');
    expect(requestStatus(['queued', 'running'])).toBe('running');
    expect(requestStatus(['completed'])).toBe('completed');
    expect(statusTone('paused')).toBe('ochre');
  });

  it('marks participants waiting on the user before ones still working', () => {
    expect(
      participantStates(
        ['scout', 'writer', 'reviewer'],
        [{ roleId: 'writer' }, { roleId: 'scout' }],
        [{ roleId: 'scout' }],
      ),
    ).toEqual([
      { id: 'scout', status: 'waiting' },
      { id: 'writer', status: 'running' },
      { id: 'reviewer', status: undefined },
    ]);
  });
});
