import { expect, it } from 'vitest';
import { $createTextNode, $getRoot, createEditor } from 'lexical';
import { ReferenceNode } from '../../ChatComposer/ReferenceNode.ts';
import { $draftState, $loadDraft } from '../../ChatComposer/editor-state.ts';
import { referenceInputs } from '../../ChatComposer/helpers.ts';
import type { ChatReference } from '@pitchcrew/core';

it('keeps queued multiline text and reference identity intact through load, text insertion and save trimming', () => {
  const text = '  Compare these\n\n@scout: one direction\nand another.  ';
  const start = text.indexOf('@scout');
  const references: ChatReference[] = [
    { kind: 'agent', id: 'scout', label: 'Scout', token: '@scout', start, end: start + 6 },
  ];
  const editor = createEditor({
    namespace: 'queue-test',
    nodes: [ReferenceNode],
    onError: (error) => {
      throw error;
    },
  });
  editor.update(() => $loadDraft(text, references), { discrete: true });
  const loaded = editor.getEditorState().read($draftState);
  expect(loaded.text).toBe(text);
  expect(loaded.references).toEqual(references);
  editor.update(
    () => {
      $getRoot().getFirstDescendant()!.insertBefore($createTextNode('New line\n'));
    },
    { discrete: true },
  );
  const edited = editor.getEditorState().read($draftState);
  expect(edited.text).toBe(`New line\n${text}`);
  expect(edited.references[0]).toEqual({ ...references[0], start: start + 9, end: start + 15 });
  const saved = referenceInputs(edited.text, edited.references);
  expect(saved[0]).not.toHaveProperty('label');
  expect(edited.text.trim().slice(saved[0]!.start, saved[0]!.end)).toBe('@scout');
  expect(saved[0]!.id).toBe('scout');
  expect(edited.text).toContain('\n\n');
});

it('preserves skill revision and trim-relative offsets while removing UI metadata', () => {
  const text = '  Read $interview\nthen discuss.  ';
  const start = text.indexOf('$interview');
  const references: ChatReference[] = [
    {
      kind: 'skill',
      id: 'interview',
      token: '$interview',
      label: 'Interview preparation',
      revision: '2026-11-06T19:00:00Z',
      start,
      end: start + '$interview'.length,
    },
  ];
  const [saved] = referenceInputs(text, references);
  expect(saved).toEqual({
    kind: 'skill',
    id: 'interview',
    token: '$interview',
    revision: references[0]!.revision,
    start: 5,
    end: 15,
  });
  expect(text.trim().slice(saved!.start, saved!.end)).toBe('$interview');
});
