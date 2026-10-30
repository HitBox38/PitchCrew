import { describe, expect, it } from 'vitest';
import { trackBeads, trackIndex } from '../helpers.ts';

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
