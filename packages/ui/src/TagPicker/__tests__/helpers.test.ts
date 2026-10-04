import { describe, expect, it } from 'vitest';
import { tagOptions, tagValues } from '../helpers.ts';

describe('job tag selection', () => {
  it('trims and deduplicates tags without losing the first spelling', () => {
    expect(tagValues(['React', ' react ', '', 'TypeScript', 'REACT'])).toEqual([
      'React',
      'TypeScript',
    ]);
  });
  it('enforces the saved-card bounds for pasted tags and a pending final tag', () => {
    const ten = Array.from({ length: 10 }, (_, index) => `Tag ${index}`);
    expect(tagValues([...ten, ' tag 0 '])).toEqual(ten);
    expect(() => tagValues([...ten, 'Extra'])).toThrow('up to 10');
    expect(tagValues(['a'.repeat(40)])).toHaveLength(1);
    expect(() => tagValues(['a'.repeat(41)])).toThrow('40 characters');
  });
  it('reuses existing tags and creates an option only for a new name', () => {
    expect(tagOptions(['React', 'react'], ['TypeScript'], ' REACT ')).toEqual({
      items: ['React', 'TypeScript'],
      custom: null,
    });
    expect(tagOptions(['React'], ['TypeScript'], ' Remote ')).toEqual({
      items: ['React', 'TypeScript', 'Remote'],
      custom: 'Remote',
    });
    expect(tagOptions([], [], ' ')).toEqual({ items: [], custom: null });
  });
});
