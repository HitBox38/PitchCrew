import { EditorSelection, EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { describe, expect, it } from 'vitest';
import { markdownEdits, tableCell, toggleTaskAt } from '../commands.ts';
import { externalChange } from '../extensions.ts';
import { markdownOutline, proseWordCount, syncChange } from '../helpers.ts';
import { mapTasks, toggleTaskAt as toggleSourceTask } from '../tasks.ts';

/** Checks or unchecks the nth rendered box the way the preview does; unchanged if unsafe. */
const toggleTaskNumber = (content: string, index: number, rendered: string[]) => {
  const at = mapTasks(content, rendered)[index];
  return at === undefined ? content : toggleSourceTask(content, at);
};

/** Applies a formatting edit to `doc` with the selection between `[` and `]` (or at `|`). */
const apply = (doc: string, edit: (state: EditorState) => unknown) => {
  const caret = doc.indexOf('|');
  const from = caret >= 0 ? caret : doc.indexOf('[');
  const to = caret >= 0 ? caret : doc.indexOf(']') - 1;
  const text = doc.replace(/[|[\]]/g, '');
  const state = EditorState.create({
    doc: text,
    selection: EditorSelection.range(from, to),
  });
  const spec = edit(state) as Parameters<EditorState['update']>[0] | null;
  if (!spec) return { text, selected: '' };
  const next = state.update(spec).state;
  const { from: start, to: end } = next.selection.main;
  return { text: next.doc.toString(), selected: next.sliceDoc(start, end), caret: start };
};

describe('markdown formatting commands', () => {
  it('wraps a selection, the word at the caret, or nothing at all, and unwraps again', () => {
    expect(apply('Led a [team] of four.', markdownEdits.bold)).toMatchObject({
      text: 'Led a **team** of four.',
      selected: 'team',
    });
    expect(apply('Led a te|am of four.', markdownEdits.italic).text).toBe('Led a _team_ of four.');
    expect(apply('Led a |', markdownEdits.code)).toMatchObject({ text: 'Led a ``', caret: 7 });
    expect(apply('Led a **[team]** of four.', markdownEdits.bold).text).toBe('Led a team of four.');
    expect(apply('Led a [~~team~~] of four.', markdownEdits.strike).text).toBe(
      'Led a team of four.',
    );
  });

  it('links a selection, and turns a selected URL into the target of a new link', () => {
    expect(apply('See [my portfolio].', markdownEdits.link)).toMatchObject({
      text: 'See [my portfolio](https://).',
      selected: 'https://',
    });
    expect(apply('See [https://dana.example].', markdownEdits.link)).toMatchObject({
      text: 'See [](https://dana.example).',
      caret: 5,
    });
  });

  it('sets, switches and clears line blocks on every selected line', () => {
    expect(apply('[First\nSecond]', markdownEdits.bullet).text).toBe('- First\n- Second');
    expect(apply('[- First\n- Second]', markdownEdits.number).text).toBe('1. First\n2. Second');
    expect(apply('[1. First\n2. Second]', markdownEdits.number).text).toBe('First\nSecond');
    expect(apply('## Exp|erience', markdownEdits.h1).text).toBe('# Experience');
    expect(apply('# Exp|erience', markdownEdits.h1).text).toBe('Experience');
    expect(apply('  - nested| item', markdownEdits.task).text).toBe('  - [ ] nested item');
    expect(apply('> quoted|', markdownEdits.paragraph).text).toBe('quoted');
  });

  it('checks and unchecks tasks without touching other lines', () => {
    const state = EditorState.create({
      doc: '- [ ] Draft\n- [x] Sent',
      extensions: markdown({ base: markdownLanguage }),
    });
    const check = state.update(toggleTaskAt(2)(state)!).state.doc.toString();
    expect(check).toBe('- [x] Draft\n- [x] Sent');
    const uncheck = state.update(toggleTaskAt(14)(state)!).state.doc.toString();
    expect(uncheck).toBe('- [ ] Draft\n- [ ] Sent');
    expect(toggleTaskAt(0)(EditorState.create({ doc: 'Plain line' }))).toBeNull();
  });

  it('inserts blocks on their own line with the caret where typing continues', () => {
    expect(apply('Intro|', markdownEdits.rule)).toMatchObject({ text: 'Intro\n---\n' });
    expect(apply('|', markdownEdits.codeblock)).toMatchObject({ text: '```\n\n```', caret: 4 });
    expect(apply('[const a = 1;]', markdownEdits.codeblock).text).toBe('```\nconst a = 1;\n```');
  });
});

describe('markdown editor helpers', () => {
  it('replaces only the changed middle so the caret survives outside updates', () => {
    expect(syncChange('same', 'same')).toBeNull();
    expect(syncChange('# Notes\nold line\nend', '# Notes\nnew line\nend')).toEqual({
      from: 8,
      to: 11,
      insert: 'new',
    });
    expect(syncChange('abc', '')).toEqual({ from: 0, to: 3, insert: '' });
    expect(syncChange('aaa', 'aaaa')).toEqual({ from: 3, to: 3, insert: 'a' });
  });

  it('lists headings outside code with their marks removed', () => {
    const outline = markdownOutline(
      '# Dana **Reyes**\n\n```md\n# not a heading\n```\n## [Projects](https://x.example) ##\n#no space',
    );
    expect(outline).toEqual([
      { level: 1, text: 'Dana Reyes', line: 1 },
      { level: 2, text: 'Projects', line: 6 },
    ]);
  });

  it('counts prose words only', () => {
    expect(proseWordCount('')).toBe(0);
    expect(proseWordCount('- [x] Ship it | 2024 |')).toBe(3);
  });
});

describe('outside changes', () => {
  it('syncs CRLF notes in editor offsets and keeps their line endings', () => {
    const crlf = EditorState.create({
      doc: 'one\r\ntwo\r\nthree\r\n',
      extensions: EditorState.lineSeparator.of('\r\n'),
    });
    const spec = externalChange(crlf, 'one\r\ntwo\r\nTHREE and more\r\n')!;
    const next = crlf.update(spec).state;
    expect(next.sliceDoc()).toBe('one\r\ntwo\r\nTHREE and more\r\n');
    expect(next.doc.lines).toBe(4);
    expect(externalChange(next, 'one\r\ntwo\r\nTHREE and more\r\n')).toBeNull();
    const lines = crlf.update(
      externalChange(crlf, 'one\r\nnew\r\nlines\r\ntwo\r\nthree\r\n')!,
    ).state;
    expect(lines.sliceDoc()).toBe('one\r\nnew\r\nlines\r\ntwo\r\nthree\r\n');
    expect(lines.doc.lines).toBe(6);
  });

  it('keeps a caret after the changed text where it was', () => {
    const state = EditorState.create({ doc: 'alpha\nbeta\ngamma', selection: { anchor: 16 } });
    const next = state.update(externalChange(state, 'alpha\nBETA!\ngamma')!).state;
    expect(next.sliceDoc()).toBe('alpha\nBETA!\ngamma');
    expect(next.selection.main.head).toBe(17);
  });
});

describe('block marks on an empty line', () => {
  it('leave the caret after the new mark, ready for the text', () => {
    for (const [kind, mark] of [
      ['number', '1. '],
      ['bullet', '- '],
      ['task', '- [ ] '],
      ['h2', '## '],
    ] as const) {
      const state = EditorState.create({
        doc: '',
        extensions: markdown({ base: markdownLanguage }),
      });
      const next = state.update(markdownEdits[kind](state)!).state;
      expect(next.doc.toString()).toBe(mark);
      expect(next.selection.main.head).toBe(mark.length);
    }
  });
});

describe('tables', () => {
  const table = '| Year | Team |\n| ---- | ---- |\n| 2024 | Atlas |';
  const md = markdown({ base: markdownLanguage });
  const at = (position: number, doc = table) =>
    EditorState.create({ doc, selection: { anchor: position }, extensions: md });
  const selected = (state: EditorState, spec: ReturnType<ReturnType<typeof tableCell>>) => {
    const next = state.update(spec!).state;
    return next.sliceDoc(next.selection.main.from, next.selection.main.to);
  };
  it('moves between cells with Tab, skipping the divider, and back with Shift-Tab', () => {
    expect(selected(at(2), tableCell(1)(at(2)))).toBe('Team');
    expect(selected(at(9), tableCell(1)(at(9)))).toBe('2024');
    const last = table.indexOf('Atlas');
    expect(selected(at(last), tableCell(-1)(at(last)))).toBe('2024');
    expect(selected(at(table.indexOf('2024')), tableCell(-1)(at(table.indexOf('2024'))))).toBe(
      'Team',
    );
  });
  it('adds a row after the last cell and ignores lines outside tables', () => {
    const end = at(table.length - 2);
    expect(end.update(tableCell(1)(end)!).state.doc.toString()).toBe(`${table}\n|  |  |`);
    expect(tableCell(1)(at(0, 'plain'))).toBeNull();
    const fenced = '```\n| A | B |\n```';
    expect(tableCell(1)(at(fenced.indexOf('B'), fenced))).toBeNull();
  });
  it('treats escaped pipes as part of a cell', () => {
    const escaped = '| A\\|B | C |\n| --- | --- |\n| 1 | 2 |';
    expect(selected(at(2, escaped), tableCell(1)(at(2, escaped)))).toBe('C');
  });

  it('adds the first body row of a header-only table after its divider', () => {
    const header = '| A | B |\n| --- | --- |';
    const state = at(header.indexOf('B'), header);
    expect(state.update(tableCell(1)(state)!).state.doc.toString()).toBe(`${header}\n|  |  |`);
  });

  it('links a multi-line selection in a CRLF note', () => {
    const state = EditorState.create({
      doc: 'abc\r\ndef\r\nghi',
      selection: { anchor: 0, head: 11 },
      extensions: [md, EditorState.lineSeparator.of('\r\n')],
    });
    const next = state.update(markdownEdits.link(state)!).state;
    expect(next.sliceDoc()).toBe('[abc\r\ndef\r\nghi](https://)');
    expect(next.sliceDoc(next.selection.main.from, next.selection.main.to)).toBe('https://');
  });

  it('handles quotes inside lists, dash-like body rows and CRLF notes', () => {
    const nested = '- > | A | B |\n  > | --- | --- |\n  > | D | E |';
    expect(selected(at(6, nested), tableCell(1)(at(6, nested)))).toBe('B');
    const d = nested.indexOf('D');
    expect(selected(at(d, nested), tableCell(-1)(at(d, nested)))).toBe('B');
    const dashes = '| A | B |\n| --- | --- |\n| C | D |\n| --- | --- |\n| E | F |';
    const fromD = dashes.indexOf('D');
    expect(selected(at(fromD, dashes), tableCell(1)(at(fromD, dashes)))).toBe('---');
    const crlf = EditorState.create({
      doc: '> | A |\r\n> | --- |\r\n> | C |',
      selection: { anchor: 22 },
      extensions: [md, EditorState.lineSeparator.of('\r\n')],
    });
    const grown = crlf.update(tableCell(1)(crlf)!).state;
    expect(grown.doc.lines).toBe(4);
    expect(grown.sliceDoc()).toBe('> | A |\r\n> | --- |\r\n> | C |\r\n> |  |');
  });

  it('moves between cells of tables in quotes and lists, keeping their marks', () => {
    const quoted = '> | Year | Team |\n> | --- | --- |\n> | 2019 | Quoted |';
    const last = quoted.length - 3;
    const state = at(last, quoted);
    const added = state.update(tableCell(1)(state)!).state;
    expect(added.doc.toString()).toBe(`${quoted}\n> |  |  |`);
    expect(selected(at(4, quoted), tableCell(1)(at(4, quoted)))).toBe('Team');
    const listed = '- | Year | Team |\n  | --- | --- |\n  | 2020 | Listed |';
    const end = at(listed.length - 3, listed);
    expect(end.update(tableCell(1)(end)!).state.doc.toString()).toBe(`${listed}\n  |  |  |`);
  });
});

describe('preview task boxes', () => {
  it('toggles the nth task the way the preview counts them', () => {
    const note = '- [ ] One\n```\n- [ ] not a task\n```\n1. [x] Two\n> - [ ] Three';
    const rendered = ['One', 'Two', 'Three'];
    expect(toggleTaskNumber(note, 0, rendered)).toBe(note.replace('- [ ] One', '- [x] One'));
    expect(toggleTaskNumber(note, 1, rendered)).toBe(note.replace('1. [x] Two', '1. [ ] Two'));
    expect(toggleTaskNumber(note, 2, rendered)).toBe(
      note.replace('> - [ ] Three', '> - [x] Three'),
    );
    expect(toggleTaskNumber(note, 3, rendered)).toBe(note);
    const indented = '    - [ ] Code example\n\n- [ ] Real task';
    expect(toggleTaskNumber(indented, 0, ['Real task'])).toBe(
      '    - [ ] Code example\n\n- [x] Real task',
    );
  });

  it('never toggles a task unless the rendered and source task lists agree', () => {
    // The preview's renderer reads "[\t]" as a task; the editor's parser does not: read-only.
    const note = '- [\t] Tab task\n\n- [ ] Real task';
    const rendered = ['Tab task', 'Real task'];
    expect(toggleTaskNumber(note, 0, rendered)).toBe(note);
    expect(toggleTaskNumber(note, 1, rendered)).toBe(note);
    const image = '- [\t] Same\n\n- [ ] ![Same](https://example.com/image.png)';
    expect(toggleTaskNumber(image, 0, ['Same', '[Image: Same]'])).toBe(image);
    // Markdown marks, images, link targets and entities are compared as the reader sees them.
    const formatted = '- [ ] Ship **v2** of [the site](https://example.com) &amp; ![Logo](x.png)';
    expect(toggleTaskNumber(formatted, 0, ['Ship v2 of the site & [Image: Logo]'])).toBe(
      formatted.replace('[ ]', '[x]'),
    );
    // Autolinks, numeric entities and blocked images read as the preview shows them.
    const autolink = '- [ ] <https://example.com> &#65;\n- [ ] ![Logo](logo.png)';
    expect(toggleTaskNumber(autolink, 1, ['https://example.com A', '[Image blocked: Logo]'])).toBe(
      autolink.replace('- [ ] ![', '- [x] !['),
    );
    // Out-of-range references read as the replacement character, never throw.
    const odd = '- [ ] &#1114112; &#x110000; &#0;\n- [ ] Ordinary task';
    expect(toggleTaskNumber(odd, 1, ['\uFFFD \uFFFD \uFFFD', 'Ordinary task'])).toBe(
      odd.replace('- [ ] Ordinary', '- [x] Ordinary'),
    );
    // Lists that agree task for task map by position, duplicates included.
    const agreed = '- [ ] Same\n- [x] Same';
    expect(toggleTaskNumber(agreed, 1, ['Same', 'Same'])).toBe('- [ ] Same\n- [ ] Same');
  });

  it('checks tasks in ordered and quoted lists from the editor too', () => {
    const state = EditorState.create({
      doc: '1. [ ] Two\n> - [ ] Three',
      extensions: markdown({ base: markdownLanguage }),
    });
    const two = state.update(toggleTaskAt(1)(state)!).state.doc.toString();
    expect(two).toBe('1. [x] Two\n> - [ ] Three');
    const three = state.update(toggleTaskAt(14)(state)!).state.doc.toString();
    expect(three).toBe('1. [ ] Two\n> - [x] Three');
  });
});
