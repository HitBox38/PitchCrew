import { autocompletion } from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  isolateHistory,
} from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { Annotation, Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  dropCursor,
  keymap,
  placeholder,
  tooltips,
  type KeyBinding,
} from '@codemirror/view';
import type { RefObject } from 'react';
import { markdownEdits, tableCell, toggleTaskAt, type MarkdownEdit } from './commands.ts';
import { markdownDecorations, showSyntax } from './decorations.ts';
import { findPanel } from './find-panel.ts';
import { renderedTables } from './tables.ts';
import { isRevealed, revealedMatch } from './reveal.ts';
import { inCode, slashCommands, slashIcon, slashOpensAt } from './slash.ts';
import { markdownHighlighting, markdownTheme } from './theme.ts';
import type { MarkdownCursor, MarkdownEditorProps, MarkdownFormat } from './types.ts';
import { syncChange } from './helpers.ts';

/** Marks transactions that mirror the controlled value rather than the user's typing. */
export const externalSync = Annotation.define<boolean>();
export const settings = new Compartment();

/**
 * The transaction that makes the editor show `content` after an outside change (a discard, a
 * newer saved copy). It diffs in CodeMirror's offsets, one character per line break, whatever
 * the note's line endings, and inserts text back with the note's own separator. Only the
 * changed middle is replaced, so the caret and scroll survive.
 */
export const externalChange = (state: EditorState, content: string) => {
  if (state.sliceDoc() === content) return null;
  const change = syncChange(state.doc.toString(), content.replace(/\r\n?/g, '\n'));
  if (!change) return null;
  return {
    changes: {
      from: change.from,
      to: change.to,
      insert: state.toText(change.insert.replace(/\n/g, state.lineBreak)),
    },
    annotations: [externalSync.of(true), isolateHistory.of('full')],
  };
};

export const run = (view: EditorView, edit: MarkdownEdit) => {
  const spec = edit(view.state);
  if (!spec) return false;
  view.dispatch(view.state.update(spec, { scrollIntoView: true, userEvent: 'input.format' }));
  return true;
};

// Formatting keys stop at the editor: ⌘B would otherwise also toggle the app sidebar.
const bind = (key: string, edit: MarkdownEdit): KeyBinding => ({
  key,
  run: (view) => run(view, edit),
  preventDefault: true,
  stopPropagation: true,
});
const formatting = keymap.of([
  bind('Mod-b', markdownEdits.bold),
  bind('Mod-i', markdownEdits.italic),
  bind('Mod-Shift-x', markdownEdits.strike),
  bind('Mod-e', markdownEdits.code),
  // Like Notion: ⌘K links a selection; with nothing selected (or only a search hit selected) it
  // still opens app search.
  {
    key: 'Mod-k',
    run: (view) =>
      !view.state.selection.main.empty && !isRevealed(view.state) && run(view, markdownEdits.link),
    stopPropagation: true,
  },
  bind('Mod-Alt-0', markdownEdits.paragraph),
  bind('Mod-Alt-1', markdownEdits.h1),
  bind('Mod-Alt-2', markdownEdits.h2),
  bind('Mod-Alt-3', markdownEdits.h3),
  bind('Mod-Shift-7', markdownEdits.number),
  bind('Mod-Shift-8', markdownEdits.bullet),
  bind('Mod-Shift-9', markdownEdits.task),
  bind('Mod-Enter', markdownEdits.task),
  // Inside tables Tab moves between cells; elsewhere it falls through to list indenting.
  { key: 'Tab', run: (view) => run(view, tableCell(1)) },
  { key: 'Shift-Tab', run: (view) => run(view, tableCell(-1)) },
]);

const inlineFormats: Record<string, MarkdownFormat> = {
  StrongEmphasis: 'bold',
  Emphasis: 'italic',
  Strikethrough: 'strike',
  InlineCode: 'code',
  Link: 'link',
  Blockquote: 'quote',
  FencedCode: 'codeblock',
  OrderedList: 'number',
  ATXHeading1: 'h1',
  ATXHeading2: 'h2',
  ATXHeading3: 'h3',
  SetextHeading1: 'h1',
  SetextHeading2: 'h2',
};

/** The syntax around the caret, as the formats a toolbar would show pressed. */
export const formatsAt = (state: EditorState, position: number): MarkdownFormat[] => {
  const formats = new Set<MarkdownFormat>();
  for (let node = syntaxTree(state).resolveInner(position, -1); ; node = node.parent!) {
    const format = inlineFormats[node.name];
    if (format) formats.add(format);
    if (node.name === 'ListItem' && node.getChild('Task')) formats.add('task');
    else if (node.name === 'BulletList' && !formats.has('task')) formats.add('bullet');
    if (!node.parent) break;
  }
  if (!['h1', 'h2', 'h3'].some((level) => formats.has(level as MarkdownFormat)))
    formats.add('paragraph');
  return [...formats];
};

export const cursorOf = (state: EditorState): MarkdownCursor => {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  return {
    line: line.number,
    column: head - line.from + 1,
    selected: state.selection.ranges.reduce((sum, range) => sum + range.to - range.from, 0),
    formats: formatsAt(state, head),
  };
};

/** Per-document settings that can change while a state is cached: editability and hints. */
export const documentSettings = (props: MarkdownEditorProps): Extension => [
  EditorView.editable.of(!props.disabled),
  EditorState.readOnly.of(!!props.disabled),
  props.placeholder ? placeholder(props.placeholder) : [],
  showSyntax.of(!!props.showSyntax),
  EditorView.contentAttributes.of({
    id: props.id,
    role: 'textbox',
    'aria-label': props.label,
    'aria-multiline': 'true',
    ...(props.describedBy ? { 'aria-describedby': props.describedBy } : {}),
    spellcheck: 'true',
    autocorrect: 'on',
    autocapitalize: 'sentences',
    'data-private': 'true',
  }),
];

const pasteLink = EditorView.domEventHandlers({
  paste: (event, view) => {
    const url = event.clipboardData?.getData('text/plain').trim() ?? '';
    const range = view.state.selection.main;
    const label = view.state.sliceDoc(range.from, range.to);
    if (
      range.empty ||
      view.state.selection.ranges.length > 1 ||
      !/^https?:\/\/\S+$/.test(url) ||
      label.includes('\n') ||
      /^https?:\/\//.test(label)
    )
      return false;
    event.preventDefault();
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: `[${label}](${url})` },
      selection: { anchor: range.from + label.length + url.length + 4 },
      userEvent: 'input.paste',
    });
    return true;
  },
  mousedown: (event, view) => {
    const target = event.target instanceof Element ? event.target.closest('.cm-md-task') : null;
    if (!target || event.button !== 0) return false;
    event.preventDefault();
    return run(view, toggleTaskAt(view.posAtDOM(target)));
  },
});

/** Height the "/" menu needs below the caret: every block, with a little air. */
const menuHeight = 440;

/**
 * Typing "/" near the bottom of the note scrolls first, in the same step, so the block menu
 * opens below the caret as Notion's does, instead of covering the line or the page above.
 */
const roomForMenu = EditorView.inputHandler.of((view, from, to, text, insert) => {
  if (text !== '/' || from !== to) return false;
  // Judged on the text as it will be: "/" after spaces can start an indented code block.
  const typed = view.state.update(insert()).state;
  if (!slashOpensAt(view.state, from) || inCode(typed, from + 1)) return false;
  const caret = view.coordsAtPos(from);
  const box = view.scrollDOM.getBoundingClientRect();
  if (!caret || box.bottom - caret.bottom >= menuHeight) return false;
  const yMargin = Math.max(24, box.height - menuHeight - (caret.bottom - caret.top));
  view.dispatch(insert(), { effects: EditorView.scrollIntoView(from, { y: 'start', yMargin }) });
  return true;
});

/**
 * Menus stay inside the editor, never over the page around it, and open below the caret while
 * there is room for a useful list there (it scrolls), rather than flipping above.
 */
const menuSpace = tooltips({
  tooltipSpace: (view) => {
    const box = view.scrollDOM.getBoundingClientRect();
    const caret = view.coordsAtPos(view.state.selection.main.head);
    const below = caret ? box.bottom - 8 - caret.bottom : 0;
    const top = caret && below >= 200 ? Math.max(box.top, caret.top - below + 1) : box.top;
    return { top, bottom: box.bottom - 8, left: box.left, right: box.right };
  },
});

export const markdownExtensions = (latest: RefObject<MarkdownEditorProps>): Extension[] => [
  // Fenced code is highlighted in its language, loaded only when a note uses it.
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  history(),
  // The caret stays still for people who asked for less motion.
  drawSelection({
    cursorBlinkRate: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1200,
  }),
  dropCursor(),
  EditorView.lineWrapping,
  syntaxHighlighting(markdownHighlighting),
  markdownDecorations,
  renderedTables,
  revealedMatch,
  markdownTheme,
  search({ top: true, createPanel: findPanel }),
  autocompletion({
    override: [slashCommands],
    icons: false,
    activateOnTyping: true,
    addToOptions: [slashIcon],
  }),
  roomForMenu,
  menuSpace,
  settings.of(documentSettings(latest.current)),
  pasteLink,
  Prec.high(formatting),
  keymap.of([...searchKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
  EditorState.transactionFilter.of((transaction) => {
    if (!transaction.docChanged || transaction.annotation(externalSync)) return transaction;
    const { maxLength, onLimit } = latest.current;
    // Count as saved: a CRLF line break is two characters on disk.
    const saved = (doc: typeof transaction.newDoc) =>
      doc.length + (doc.lines - 1) * (transaction.startState.lineBreak.length - 1);
    const size = saved(transaction.newDoc);
    if (size <= maxLength || size <= saved(transaction.startState.doc)) return transaction;
    queueMicrotask(() => onLimit?.());
    return [];
  }),
  EditorView.updateListener.of((update) => {
    const props = latest.current;
    const typed = update.transactions.some((tr) => tr.docChanged && !tr.annotation(externalSync));
    if (update.docChanged && typed) props.onChange(update.state.sliceDoc());
    if (update.docChanged || update.selectionSet) props.onCursor?.(cursorOf(update.state));
  }),
];
