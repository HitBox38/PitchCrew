import { describe, expect, it } from 'vitest';
import { diffCounts, diffInstructions, diffSequence, diffWords, paragraphs } from '../helpers.ts';

describe('instruction diff', () => {
  it('finds the longest common sequence with removals before additions', () => {
    expect(diffSequence(['a', 'b', 'c'], ['a', 'x', 'c', 'd'])).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'added', text: 'x' },
      { kind: 'same', text: 'c' },
      { kind: 'added', text: 'd' },
    ]);
    expect(diffSequence([], ['a'])).toEqual([{ kind: 'added', text: 'a' }]);
    expect(diffSequence(['a'], [])).toEqual([{ kind: 'removed', text: 'a' }]);
  });

  it('marks changed words inside a similar paragraph', () => {
    const before =
      "Read pitchcrew_application_insights filtered by the job's main tags before drafting.";
    const after =
      "Read pitchcrew_application_insights filtered by the job's main tags before you write.";
    const lines = diffInstructions(`Intro.\n\n${before}`, `Intro.\n\n${after}`);
    expect(lines.map((line) => line.kind)).toEqual(['same', 'removed', 'added']);
    expect(lines[1].segments?.filter((s) => s.kind === 'removed').map((s) => s.text)).toEqual([
      'drafting.',
    ]);
    expect(lines[2].segments?.filter((s) => s.kind === 'added').map((s) => s.text)).toEqual([
      'you write.',
    ]);
    // Joined segments rebuild each side exactly.
    expect(lines[1].segments?.map((s) => s.text).join('')).toBe(before);
    expect(lines[2].segments?.map((s) => s.text).join('')).toBe(after);
  });

  it('shows rewritten paragraphs as whole lines', () => {
    const lines = diffInstructions(
      'Keep the resume short.',
      'Follow the packet rules in your prompt.',
    );
    expect(lines).toEqual([
      { kind: 'removed', text: 'Keep the resume short.' },
      { kind: 'added', text: 'Follow the packet rules in your prompt.' },
    ]);
  });

  it('shows a new paragraph as added and counts non-blank paragraphs', () => {
    const lines = diffInstructions('One.\n\nTwo.', 'One.\n\nNew.\n\nTwo.');
    expect(lines.filter((line) => line.kind === 'added').map((line) => line.text)).toEqual([
      'New.',
    ]);
    expect(diffCounts(lines)).toEqual({ same: 2, added: 1, removed: 0 });
    expect(diffInstructions('Same.', 'Same.')).toEqual([{ kind: 'same', text: 'Same.' }]);
    expect(diffInstructions('', 'Only.\n  \nTwo.')).toEqual([
      { kind: 'added', text: 'Only.' },
      { kind: 'added', text: 'Two.' },
    ]);
    expect(paragraphs('One\nline.\n\n\nNext.')).toEqual(['One\nline.', 'Next.']);
  });

  it('keeps whitespace in word diffs and falls back for very long input', () => {
    expect(diffWords('a  b', 'a c')).toEqual({
      removed: [
        { kind: 'same', text: 'a' },
        { kind: 'removed', text: '  b' },
      ],
      added: [
        { kind: 'same', text: 'a' },
        { kind: 'added', text: ' c' },
      ],
    });
    const many = Array.from({ length: 1500 }, (_, index) => `line ${index}`);
    const result = diffSequence(many, [...many].reverse());
    expect(result.filter((item) => item.kind === 'removed')).toHaveLength(1500);
    expect(result.filter((item) => item.kind === 'added')).toHaveLength(1500);
  });
});
