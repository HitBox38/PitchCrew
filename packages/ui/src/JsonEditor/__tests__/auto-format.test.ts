import { expect, it } from 'vitest';
import { EditorState, Transaction } from '@codemirror/state';
import { history, undo } from '@codemirror/commands';
import { autoFormatting } from '../auto-format.ts';

it('leaves paste and typing untouched by default and reads preference changes immediately', () => {
  const preferences = { jsonFormatOnPaste: false, jsonFormatOnType: false };
  let state = EditorState.create({ extensions: [autoFormatting(() => preferences)] });
  const source = '{"version":1}';
  state = state.update({
    changes: { from: 0, insert: source },
    annotations: Transaction.userEvent.of('input.paste'),
  }).state;
  expect(state.doc.toString()).toBe(source);
  preferences.jsonFormatOnPaste = true;
  state = state.update({
    changes: { from: 0, to: state.doc.length, insert: source },
    annotations: Transaction.userEvent.of('input.paste'),
  }).state;
  expect(state.doc.toString()).toBe('{\n  "version": 1\n}\n');
});

it('retains the caret inside an edited string when typing reformats the document', () => {
  const source = '{"message":"keep typing"}';
  const position = source.indexOf(' typing');
  const state = EditorState.create({
    doc: source,
    extensions: [autoFormatting(() => ({ jsonFormatOnPaste: false, jsonFormatOnType: true }))],
  });
  const result = state.update({
    changes: { from: position, insert: ' on' },
    selection: { anchor: position + 3 },
    annotations: Transaction.userEvent.of('input.type'),
  }).state;
  expect(result.doc.toString()).toBe('{\n  "message": "keep on typing"\n}\n');
  expect(result.doc.sliceString(0, result.selection.main.head).endsWith('keep on')).toBe(true);
});

it('keeps incomplete JSON and IME composition editable and ignores programmatic replacements', () => {
  const state = EditorState.create({
    extensions: [autoFormatting(() => ({ jsonFormatOnPaste: true, jsonFormatOnType: true }))],
  });
  for (const [source, event] of [
    ['{broken', 'input.type'],
    ['{"x":1}', 'input.type.compose'],
    ['{"x":1}', undefined],
  ] as const) {
    const next = state.update({
      changes: { from: 0, insert: source },
      ...(event ? { annotations: Transaction.userEvent.of(event) } : {}),
    }).state;
    expect(next.doc.toString()).toBe(source);
  }
});

it('undoes the pasted source and automatic formatting together', () => {
  let state = EditorState.create({
    doc: '{}',
    extensions: [
      history(),
      autoFormatting(() => ({ jsonFormatOnPaste: true, jsonFormatOnType: false })),
    ],
  });
  state = state.update({
    changes: { from: 0, to: 2, insert: '{"x":1}' },
    annotations: Transaction.userEvent.of('input.paste'),
  }).state;
  expect(state.doc.toString()).toBe('{\n  "x": 1\n}\n');
  expect(
    undo({
      state,
      dispatch: (transaction) => {
        state = transaction.state;
      },
    }),
  ).toBe(true);
  expect(state.doc.toString()).toBe('{}');
});
