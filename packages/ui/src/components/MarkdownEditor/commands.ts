import { syntaxTree } from '@codemirror/language';
import {
  ChangeSet,
  EditorSelection,
  type ChangeSpec,
  type EditorState,
  type TransactionSpec,
} from '@codemirror/state';
import type { MarkdownFormat } from './types.ts';

/** A pure edit: the transaction that applies a format to a state, so tests need no DOM. */
export type MarkdownEdit = (state: EditorState) => TransactionSpec | null;

const prefixPattern =
  /^(\s*)(#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+\[[ xX]\][ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)?/;
type Block = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'task' | 'quote';

const blockOf = (prefix = ''): Block | 'other' => {
  if (!prefix) return 'paragraph';
  if (/^#[ \t]/.test(prefix)) return 'h1';
  if (/^##[ \t]/.test(prefix)) return 'h2';
  if (/^###[ \t]/.test(prefix)) return 'h3';
  if (prefix.startsWith('>')) return 'quote';
  if (/\[[ xX]\]/.test(prefix)) return 'task';
  if (/^\d/.test(prefix)) return 'number';
  if (/^[-*+]/.test(prefix)) return 'bullet';
  return 'other';
};

const prefixFor = (block: Block, index: number) =>
  ({
    paragraph: '',
    h1: '# ',
    h2: '## ',
    h3: '### ',
    bullet: '- ',
    number: `${index + 1}. `,
    task: '- [ ] ',
    quote: '> ',
  })[block];

/** Wraps each selection (or the word at an empty caret) in a marker, or removes it again. */
const toggleInline =
  (marker: string): MarkdownEdit =>
  (state) => {
    const size = marker.length;
    return state.changeByRange((range) => {
      const outside =
        state.sliceDoc(range.from - size, range.from) === marker &&
        state.sliceDoc(range.to, range.to + size) === marker;
      if (outside)
        return {
          changes: [
            { from: range.from - size, to: range.from },
            { from: range.to, to: range.to + size },
          ],
          range: EditorSelection.range(range.from - size, range.to - size),
        };
      const text = state.sliceDoc(range.from, range.to);
      if (text.length >= size * 2 && text.startsWith(marker) && text.endsWith(marker))
        return {
          changes: { from: range.from, to: range.to, insert: text.slice(size, -size) },
          range: EditorSelection.range(range.from, range.to - size * 2),
        };
      const word = range.empty ? state.wordAt(range.head) : null;
      const from = word?.from ?? range.from;
      const to = word?.to ?? range.to;
      return {
        changes: [
          { from, insert: marker },
          { from: to, insert: marker },
        ],
        range: range.empty
          ? EditorSelection.cursor(range.head + size)
          : EditorSelection.range(range.from + size, range.to + size),
      };
    });
  };

/** Links the selection; a selected URL becomes the target and the caret waits for the label. */
const insertLink: MarkdownEdit = (state) =>
  state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to);
    if (/^https?:\/\/\S+$/.test(text))
      return {
        changes: { from: range.from, to: range.to, insert: `[](${text})` },
        range: EditorSelection.cursor(range.from + 1),
      };
    const label = text || 'link text';
    // Offsets in the document's own terms: a CRLF line break is one position, two characters.
    const length = text ? range.to - range.from : label.length;
    const target = range.from + length + 3;
    return {
      changes: { from: range.from, to: range.to, insert: `[${label}](https://)` },
      range: text
        ? EditorSelection.range(target, target + 8)
        : EditorSelection.range(range.from + 1, range.from + 1 + length),
    };
  });

/** Sets every touched line to one block kind, or back to a paragraph when all already are. */
const setBlock =
  (block: Block): MarkdownEdit =>
  (state) => {
    const lines = new Set<number>();
    for (const range of state.selection.ranges)
      for (
        let line = state.doc.lineAt(range.from).number;
        line <= state.doc.lineAt(range.to).number;
        line++
      )
        lines.add(line);
    const touched = [...lines].map((number) => state.doc.line(number));
    const parsed = touched.map((line) => prefixPattern.exec(line.text)!);
    const all = parsed.every((match) => blockOf(match[2]) === block);
    const target: Block = all && block !== 'paragraph' ? 'paragraph' : block;
    const changes = touched.map((line, index) => {
      const [, indent, prefix = ''] = parsed[index];
      const keepIndent = ['bullet', 'number', 'task'].includes(target) ? indent : '';
      return {
        from: line.from,
        to: line.from + indent.length + prefix.length,
        insert: keepIndent + prefixFor(target, index),
      };
    });
    // A caret at the start of the line (an empty line, the "/" menu) lands after the new mark,
    // ready for the item's text, not in front of it.
    const set = state.changes(changes);
    return { changes: set, selection: state.selection.map(set, 1) };
  };

/** Checks or unchecks the task on the line holding `position`, in any list or quote. */
export const toggleTaskAt =
  (position: number): MarkdownEdit =>
  (state) => {
    const line = state.doc.lineAt(position);
    let marker: { from: number } | null = null;
    syntaxTree(state).iterate({
      from: line.from,
      to: line.to,
      enter: (node) => {
        if (node.name === 'TaskMarker' && !marker) marker = { from: node.from };
      },
    });
    if (!marker) return null;
    const from = (marker as { from: number }).from + 1;
    const checked = state.sliceDoc(from, from + 1) !== ' ';
    return { changes: { from, to: from + 1, insert: checked ? ' ' : 'x' } };
  };

const toggleTask: MarkdownEdit = (state) =>
  toggleTaskAt(state.selection.main.head)(state) ?? setBlock('task')(state);

/** Inserts a block of text on its own line after the caret's line, then places the caret. */
const insertBlock =
  (text: string, caret: number): MarkdownEdit =>
  (state) => {
    const line = state.doc.lineAt(state.selection.main.head);
    const blank = !line.text.trim();
    const insert = blank ? text : `\n${text}`;
    const from = blank ? line.from : line.to;
    return {
      changes: { from, to: blank ? line.to : from, insert },
      selection: EditorSelection.cursor(from + (blank ? 0 : 1) + caret),
    };
  };

const fenceSelection: MarkdownEdit = (state) => {
  const range = state.selection.main;
  if (range.empty) return insertBlock('```\n\n```', 4)(state);
  const first = state.doc.lineAt(range.from);
  const last = state.doc.lineAt(range.to);
  return {
    changes: [
      { from: first.from, insert: '```\n' },
      { from: last.to, insert: '\n```' },
    ],
  };
};

/** Inserted "\n" becomes the note's own line break, so a CRLF note keeps its line structure. */
const fixBreaks = (state: EditorState, changes: ChangeSpec): ChangeSpec => {
  if (Array.isArray(changes)) return changes.map((change) => fixBreaks(state, change));
  if (changes instanceof ChangeSet || !('from' in changes) || typeof changes.insert !== 'string')
    return changes;
  return { ...changes, insert: changes.insert.replace(/\n/g, state.lineBreak) };
};
const ownBreaks =
  (edit: MarkdownEdit): MarkdownEdit =>
  (state) => {
    const spec = edit(state);
    if (!spec?.changes || state.lineBreak === '\n') return spec;
    return { ...spec, changes: fixBreaks(state, spec.changes) };
  };

const edits: Record<MarkdownFormat, MarkdownEdit> = {
  bold: toggleInline('**'),
  italic: toggleInline('_'),
  strike: toggleInline('~~'),
  code: toggleInline('`'),
  link: insertLink,
  paragraph: setBlock('paragraph'),
  h1: setBlock('h1'),
  h2: setBlock('h2'),
  h3: setBlock('h3'),
  bullet: setBlock('bullet'),
  number: setBlock('number'),
  task: toggleTask,
  quote: setBlock('quote'),
  codeblock: fenceSelection,
  rule: insertBlock('---\n', 4),
  table: insertBlock('| Column | Column |\n| ------ | ------ |\n|        |        |\n', 2),
};
export const markdownEdits = Object.fromEntries(
  Object.entries(edits).map(([kind, edit]) => [kind, ownBreaks(edit)]),
) as Record<MarkdownFormat, MarkdownEdit>;

/** A row's container marks: any mix of quote bars, indentation and list markers. */
const container = /^(?:[ \t]*(?:>[ \t]?|(?:[-*+]|\d+[.)])[ \t]+))*[ \t]*/;
const rowOf = (text: string) => text.slice(container.exec(text)![0].length);
const tableRow = (text: string) => /^\|.*\|\s*$/.test(rowOf(text));
/** The container marks a new row repeats: the same quote bars; list markers become spaces. */
const continuation = (text: string) =>
  container
    .exec(text)![0]
    .replace(/(?:[-*+]|\d+[.)])[ \t]+/g, (marker) => ' '.repeat(marker.length));
/** Cell borders: pipes that are not escaped as \| inside a cell. */
const pipes = (text: string) => [...text.matchAll(/(?<!\\)\|/g)].map((match) => match.index);
const tableAt = (state: EditorState, position: number) => {
  for (let node = syntaxTree(state).resolveInner(position, 1); node; node = node.parent!) {
    if (node.name === 'Table') return node;
    if (!node.parent) return null;
  }
  return null;
};

/**
 * Tab and Shift-Tab inside a Markdown table move between cells like a spreadsheet, past the
 * header divider; Tab in the last cell adds a row (with the table's quote or list marks).
 * Outside a table they do nothing.
 */
export const tableCell = (step: 1 | -1): MarkdownEdit =>
  ownBreaks((state) => {
    const { head } = state.selection.main;
    const line = state.doc.lineAt(head);
    const lead = container.exec(line.text)![0].length;
    const table = tableRow(line.text) ? tableAt(state, line.from + lead) : null;
    if (!table) return null;
    const first = state.doc.lineAt(table.from).number;
    const last = state.doc.lineAt(table.to).number;
    const bars = pipes(line.text);
    const column = head - line.from;
    const cell = bars.findLastIndex((bar) => bar < column);
    const into = (target: typeof line, index: number) => {
      const marks = pipes(target.text);
      const start = target.from + marks[index] + 1;
      const end = target.from + marks[index + 1];
      const text = state.sliceDoc(start, end);
      const from = start + (text.length - text.trimStart().length);
      const to = Math.max(from, end - (text.length - text.trimEnd().length));
      return { selection: EditorSelection.range(from, to), scrollIntoView: true };
    };
    // Rows of this table only; the header's divider (its second line) is skipped, while a body
    // row that merely looks like one is a row like any other.
    const row = (number: number, direction: 1 | -1): typeof line | null => {
      if (number < first || number > last) return null;
      if (number === first + 1) return row(number + direction, direction);
      const next = state.doc.line(number);
      return tableRow(next.text) ? next : null;
    };
    if (step === 1) {
      if (cell + 1 < bars.length - 1) return into(line, cell + 1);
      const below = row(line.number + 1, 1);
      if (below) return into(below, 0);
      // A new row goes after the table's last line (after the divider of a header-only table).
      const end = state.doc.line(Math.max(line.number, last)).to;
      const cells = Math.max(1, bars.length - 1);
      const prefix = continuation(line.text);
      const insert = `\n${prefix}|${'  |'.repeat(cells)}`;
      return {
        changes: { from: end, insert },
        selection: EditorSelection.cursor(end + 1 + prefix.length + 2),
        scrollIntoView: true,
      };
    }
    if (cell > 0) return into(line, cell - 1);
    const above = row(line.number - 1, -1);
    return above ? into(above, pipes(above.text).length - 2) : { selection: { anchor: head } };
  });
