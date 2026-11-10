import { syntaxTree } from '@codemirror/language';
import { StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import type { SyntaxNodeRef } from '@lezer/common';
import { showSyntax } from './decorations.ts';
import { renderInline } from './inline.ts';

/** Rows drawn before the rest of a very long table is left to its source. */
const shownRows = 200;

/** A row's cells as offsets in the line: unescaped pipes split cells; outer pipes are optional. */
export const rowCells = (line: string) => {
  const pipes: number[] = [];
  for (let at = 0; at < line.length; at++)
    if (line[at] === '\\') at++;
    else if (line[at] === '|') pipes.push(at);
  const bounds = [-1, ...pipes, line.length];
  const cells = bounds.slice(1).map((to, k) => ({ from: bounds[k] + 1, to }));
  if (pipes.length && !line.slice(0, pipes[0]).trim()) cells.shift();
  if (pipes.length && pipes.at(-1) === line.trimEnd().length - 1) cells.pop();
  return cells.map(({ from, to }) => {
    while (from < to && /\s/.test(line[from])) from++;
    while (to > from && /\s/.test(line[to - 1])) to--;
    return { from, to };
  });
};

/** A table drawn like the preview's; clicking a cell opens the Markdown there for editing. */
class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly from: number,
    /** Where the table starts on its first line (after "- " or "> "), and later lines' prefix. */
    readonly first: number,
    readonly prefix: RegExp,
    readonly nesting: string,
  ) {
    super();
  }
  eq(other: TableWidget) {
    return (
      other.source === this.source && other.from === this.from && other.nesting === this.nesting
    );
  }
  get estimatedHeight() {
    return Math.min(this.source.split('\n').length, shownRows + 2) * 34;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = `cm-md-table-widget ${this.nesting}`;
    wrap.title = 'Click a cell to edit the table';
    const table = wrap.appendChild(document.createElement('table'));
    const head = table.appendChild(document.createElement('thead'));
    const body = table.appendChild(document.createElement('tbody'));
    let offset = this.from;
    let columns = 1;
    const lines = this.source.split('\n');
    lines.forEach((line, index) => {
      const start = offset + (index ? (this.prefix.exec(line)?.[0].length ?? 0) : this.first);
      const text = line.slice(start - offset);
      offset += line.length + 1;
      if (index === 1 || !text.trim() || index > shownRows + 1) return;
      const row = (index ? body : head).appendChild(document.createElement('tr'));
      for (const cell of rowCells(text)) {
        const element = row.appendChild(document.createElement(index ? 'td' : 'th'));
        element.dataset.from = String(start + cell.from);
        element.dataset.to = String(start + cell.to);
        renderInline(text.slice(cell.from, cell.to), element);
      }
      columns = Math.max(columns, row.childElementCount);
    });
    if (lines.length > shownRows + 2) {
      const more = body.appendChild(document.createElement('tr'));
      const cell = more.appendChild(document.createElement('td'));
      cell.colSpan = columns;
      cell.className = 'cm-md-table-more';
      cell.textContent = `${lines.length - shownRows - 2} more rows. Click to edit the table.`;
    }
    wrap.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const cell = (event.target as Element).closest<HTMLElement>('[data-from]');
      const anchor = cell ? Number(cell.dataset.from) : this.from;
      const head = cell ? Number(cell.dataset.to) : anchor;
      view.dispatch({ selection: { anchor, head }, scrollIntoView: true });
      view.focus();
    });
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

const quoted = /^(?:[ \t]*>)+[ \t]?/;
const indented = /^[ \t]*/;

/** Tables the selection is not in, as block widgets; a table with the caret shows its source. */
const tables = (state: EditorState): DecorationSet => {
  if (state.facet(showSyntax)) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  const touches = (from: number, to: number) =>
    state.selection.ranges.some((range) => range.from <= to && range.to >= from);
  const add = (node: SyntaxNodeRef) => {
    const from = state.doc.lineAt(node.from).from;
    const to = state.doc.lineAt(node.to).to;
    if (touches(from, to)) return;
    let quotes = 0;
    let items = 0;
    for (let parent = node.node.parent; parent; parent = parent.parent)
      if (parent.name === 'Blockquote') quotes++;
      else if (parent.name === 'ListItem') items++;
    const nesting = `${quotes ? 'cm-md-table-quoted' : ''} ${items ? `cm-md-table-in-list-${Math.min(items, 4)}` : ''}`;
    const widget = new TableWidget(
      state.doc.sliceString(from, to),
      from,
      node.from - from,
      quotes ? quoted : indented,
      nesting.trim(),
    );
    ranges.push(Decoration.replace({ widget, block: true }).range(from, to));
  };
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'Table') add(node);
      return !['Table', 'FencedCode', 'CodeBlock', 'HTMLBlock'].includes(node.name);
    },
  });
  return Decoration.set(ranges, true);
};

/** Live preview for tables: block widgets must come from a state field, not a view plugin. */
export const renderedTables = StateField.define<DecorationSet>({
  create: tables,
  update: (value, transaction) =>
    transaction.docChanged ||
    transaction.selection ||
    syntaxTree(transaction.startState) !== syntaxTree(transaction.state) ||
    transaction.startState.facet(showSyntax) !== transaction.state.facet(showSyntax)
      ? tables(transaction.state)
      : value,
  provide: (field) => EditorView.decorations.from(field),
});
