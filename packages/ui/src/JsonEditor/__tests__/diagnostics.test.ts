import { expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { issueDiagnostics } from '../helpers.ts';

it('locates rule errors at the exact field even with repeated keys in other rules', () => {
  const text = '{"rules":[{"max":1},{"max":-5}]}';
  const state = EditorState.create({ doc: text });
  const [issue] = issueDiagnostics(state, [
    { path: ['rules', 1, 'max'], message: 'Must be positive.' },
  ]);
  expect(text.slice(issue!.from, issue!.to)).toBe('-5');
  expect(issue!.message).toBe('Must be positive.');
});

it('places missing-field errors on their containing rule', () => {
  const text = '{"rules":[{"kind":"word_limit"}]}';
  const [issue] = issueDiagnostics(EditorState.create({ doc: text }), [
    { path: ['rules', 0, 'max'], message: 'Required' },
  ]);
  expect(text.slice(issue!.from, issue!.to)).toBe('{"kind":"word_limit"}');
});
