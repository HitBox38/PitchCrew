import type { Completion, CompletionSource } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import type { EditorView } from '@codemirror/view';
import { markdownEdits } from './commands.ts';
import { toolIcon } from './icons.ts';
import type { MarkdownFormat } from './types.ts';

const sections = {
  text: { name: 'Text', rank: 0 },
  lists: { name: 'Lists', rank: 1 },
  blocks: { name: 'Blocks', rank: 2 },
};
const blocks: {
  label: string;
  detail: string;
  kind: MarkdownFormat;
  words: string;
  section: keyof typeof sections;
}[] = [
  { label: 'Heading 1', detail: '#', kind: 'h1', words: 'title h1', section: 'text' },
  { label: 'Heading 2', detail: '##', kind: 'h2', words: 'section h2', section: 'text' },
  { label: 'Heading 3', detail: '###', kind: 'h3', words: 'subsection h3', section: 'text' },
  { label: 'Bulleted list', detail: '-', kind: 'bullet', words: 'unordered', section: 'lists' },
  { label: 'Numbered list', detail: '1.', kind: 'number', words: 'ordered', section: 'lists' },
  { label: 'Checklist', detail: '- [ ]', kind: 'task', words: 'todo task', section: 'lists' },
  { label: 'Quote', detail: '>', kind: 'quote', words: 'blockquote', section: 'blocks' },
  { label: 'Code block', detail: '```', kind: 'codeblock', words: 'fence', section: 'blocks' },
  { label: 'Table', detail: '| |', kind: 'table', words: 'grid columns', section: 'blocks' },
  { label: 'Divider', detail: '---', kind: 'rule', words: 'rule line', section: 'blocks' },
];
const kinds = new Map(blocks.map((block) => [block.label, block.kind]));

/** Each option's icon: the toolbar's own lucide icon, drawn once and cloned. */
export const slashIcon = {
  position: 20,
  render: (completion: Completion) => {
    const tile = document.createElement('span');
    tile.className = 'cm-md-slash-icon';
    tile.setAttribute('aria-hidden', 'true');
    const kind = kinds.get(completion.displayLabel ?? '');
    if (kind) tile.append(toolIcon(kind));
    return tile;
  },
};

/** Runs a block format after removing the typed "/query". */
const apply =
  (kind: MarkdownFormat) =>
  (view: EditorView, _completion: Completion, from: number, to: number) => {
    view.dispatch({ changes: { from: from - 1, to }, userEvent: 'delete.slash' });
    const spec = markdownEdits[kind](view.state);
    if (spec)
      view.dispatch(view.state.update(spec, { scrollIntoView: true, userEvent: 'input.format' }));
  };

/** Inside code, "/" is just a character. */
export const inCode = (state: EditorState, position: number) => {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, -1);
    node;
    node = node.parent
  )
    if (['FencedCode', 'CodeBlock', 'InlineCode'].includes(node.name)) return true;
  return false;
};

/** Where "/" opens the block menu: a line start, or a list or task item's start; not in code. */
export const slashOpensAt = (state: EditorState, position: number) => {
  const line = state.doc.lineAt(position);
  const before = state.sliceDoc(line.from, position);
  return /^\s*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?$/.test(before) && !inCode(state, position);
};

/** "/" at the start of a line opens the block menu, Notion-style; never inside code. */
export const slashCommands: CompletionSource = (context) => {
  const line = context.state.doc.lineAt(context.pos);
  const before = context.state.sliceDoc(line.from, context.pos);
  // At the start of a line, or of a list item ("- /" turns the item into a block).
  const match = /^(\s*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?)\/([\w ]{0,20})$/.exec(before);
  if (!match || inCode(context.state, context.pos)) return null;
  return {
    from: line.from + match[1].length + 1,
    validFor: /^[\w ]*$/,
    // The label carries search words ("todo" finds Checklist); only the name is shown.
    options: blocks.map((block, index): Completion => ({
      // Equal matches keep the menu's own order: headings first, the divider last.
      boost: blocks.length - index,
      label: `${block.label} ${block.words}`,
      displayLabel: block.label,
      detail: block.detail,
      section: sections[block.section],
      apply: apply(block.kind),
    })),
  };
};
