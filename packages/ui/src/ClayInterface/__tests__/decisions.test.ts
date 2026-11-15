import { describe, expect, it } from 'vitest';
import { validateInboxSearch } from '../../navigation.ts';

describe('clay decisions page', () => {
  it('accepts only decision identifiers in the inbox search', () => {
    expect(validateInboxSearch({ decision: 'brief-card-1' })).toEqual({
      decision: 'brief-card-1',
    });
    expect(validateInboxSearch({ decision: '../settings' })).toEqual({ decision: undefined });
    expect(validateInboxSearch({ decision: 4 })).toEqual({ decision: undefined });
    expect(validateInboxSearch({ view: 'history', entry: 'packet:approval-1' })).toEqual({
      view: 'history',
      entry: 'packet:approval-1',
    });
    expect(validateInboxSearch({ view: 'board', entry: 'packet:approval-1' })).toEqual({});
    expect(validateInboxSearch({ view: 'history', entry: '<script>' })).toEqual({
      view: 'history',
    });
  });
});
