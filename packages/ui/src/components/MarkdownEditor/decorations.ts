import { syntaxTree } from '@codemirror/language';
import { Facet, type EditorState, type Range } from '@codemirror/state';
import {
  Decoration,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view';
import type { SyntaxNodeRef } from '@lezer/common';

/** True shows every Markdown mark (source mode); false hides them away from the caret. */
export const showSyntax = Facet.define<boolean, boolean>({
  combine: (values) => values.some(Boolean),
});

const lineDecorations = new Map<string, Decoration>();
const line = (className: string) => {
  let decoration = lineDecorations.get(className);
  if (!decoration) {
    decoration = Decoration.line({ class: className });
    lineDecorations.set(className, decoration);
  }
  return decoration;
};
/** A list item's first line, with a hanging indent so wrapped text lines up under the text. */
const listLines = new Map<string, Decoration>();
const listLine = (indent: number, task: boolean) => {
  const key = `${indent}:${task}`;
  let decoration = listLines.get(key);
  if (!decoration) {
    decoration = Decoration.line({
      class: task ? 'cm-md-li cm-md-li-task' : 'cm-md-li',
      attributes: { style: `--md-indent: ${indent}` },
    });
    listLines.set(key, decoration);
  }
  return decoration;
};
const inlineCode = Decoration.mark({ class: 'cm-md-inline-code' });
const linkText = Decoration.mark({ class: 'cm-md-link-text' });
const hide = Decoration.replace({});
const task = (checked: boolean) =>
  Decoration.mark({
    class: 'cm-md-task',
    attributes: { 'data-checked': String(checked), title: checked ? 'Mark not done' : 'Mark done' },
  });

const check =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** A task box drawn like the app's checkbox; clicking it checks or unchecks the task. */
class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }
  toDOM() {
    const box = document.createElement('span');
    box.className = 'cm-md-checkbox cm-md-task';
    box.dataset.checked = String(this.checked);
    box.setAttribute('aria-hidden', 'true');
    box.title = this.checked ? 'Mark not done' : 'Mark done';
    if (this.checked) box.innerHTML = check;
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const dot = document.createElement('span');
    dot.className = 'cm-md-bullet';
    dot.setAttribute('aria-hidden', 'true');
    return dot;
  }
}
const bullet = Decoration.replace({ widget: new BulletWidget() });

/** The language of a fenced code block, as a small chip where its opening fence was. */
class LanguageWidget extends WidgetType {
  constructor(readonly language: string) {
    super();
  }
  eq(other: LanguageWidget) {
    return other.language === this.language;
  }
  toDOM(view: EditorView) {
    const chip = document.createElement('span');
    chip.className = 'cm-md-code-language';
    chip.textContent = this.language;
    chip.title = 'Edit this code block';
    // Clicking the chip opens the block's fences, like clicking its code.
    chip.addEventListener('mousedown', (event) => {
      event.preventDefault();
      view.dispatch({ selection: { anchor: view.state.doc.lineAt(view.posAtDOM(chip)).to } });
      view.focus();
    });
    return chip;
  }
}

/** Notion's quiet cue on an empty line: blocks are one "/" away. */
class HintWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const hint = document.createElement('span');
    hint.className = 'cm-md-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Type / for headings, lists and tables';
    return hint;
  }
}
const hint = Decoration.widget({ widget: new HintWidget(), side: 1 });

/** Lines touched by any selection keep their raw Markdown so it can be edited. */
const activeLines = (state: EditorState) => {
  const lines = new Set<number>();
  for (const range of state.selection.ranges)
    for (let n = state.doc.lineAt(range.from).number; n <= state.doc.lineAt(range.to).number; n++)
      lines.add(n);
  return lines;
};

/**
 * Obsidian-style live preview: sized heading lines, quote bars, code and table wells, and, on
 * every line the caret is not on, the Markdown marks hidden (bullets and task boxes drawn). The
 * text itself never changes; moving onto a line shows its source again.
 */
const build = (view: EditorView): DecorationSet => {
  const ranges: Range<Decoration>[] = [];
  const { state } = view;
  const { doc } = state;
  const live = !state.facet(showSyntax);
  // Like Obsidian: a note shows rendered until the caret is in it; then only its lines open up.
  const active = view.hasFocus ? activeLines(state) : new Set<number>();
  const quiet = (position: number) => live && !active.has(doc.lineAt(position).number);
  // Bullets and task boxes stay drawn on the caret's line too (so the text never shifts);
  // they open up only when the selection touches the marker itself.
  const touched = (from: number, to: number) =>
    view.hasFocus && state.selection.ranges.some((range) => range.from <= to && range.to >= from);
  const drawn = (from: number, to: number) => live && !touched(from, to);
  const after = (position: number) => (doc.sliceString(position, position + 1) === ' ' ? 1 : 0);
  const eachLine = (from: number, to: number, className: string, ends = false) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let number = first; number <= last; number++) {
      const classes = [className];
      if (ends && number === first) classes.push(`${className}-start`);
      if (ends && number === last) classes.push(`${className}-end`);
      ranges.push(line(classes.join(' ')).range(doc.line(number).from));
    }
  };
  /** Away from the caret a fenced block hides its fence lines; the language shows as a chip. */
  const fence = (node: SyntaxNodeRef) => {
    const first = doc.lineAt(node.from);
    const last = doc.lineAt(node.to);
    for (let n = first.number; n <= last.number; n++) if (!quiet(doc.line(n).from)) return;
    const language = node.node.getChild('CodeInfo');
    const label = language ? doc.sliceString(language.from, language.to) : '';
    ranges.push(
      (label ? Decoration.replace({ widget: new LanguageWidget(label) }) : hide).range(
        first.from,
        first.to,
      ),
    );
    const closing = node.node.lastChild;
    if (last.number > first.number && closing?.name === 'CodeMark' && closing.from >= last.from)
      ranges.push(hide.range(last.from, last.to));
  };
  const link = (node: SyntaxNodeRef) => {
    const marks: number[] = [];
    const cursor = node.node.cursor();
    if (cursor.firstChild())
      do if (cursor.name === 'LinkMark') marks.push(cursor.from);
      while (cursor.nextSibling());
    if (marks.length < 2 || marks[0] !== node.from) return;
    ranges.push(linkText.range(marks[0] + 1, marks[1]));
    // A link written across lines keeps its source: hiding may never swallow a line break.
    if (!quiet(node.from) || doc.lineAt(node.from).number !== doc.lineAt(node.to).number) return;
    ranges.push(hide.range(node.from, node.from + 1), hide.range(marks[1], node.to));
  };
  const enter = (node: SyntaxNodeRef) => {
    const heading = /^(?:ATX|Setext)Heading(\d)$/.exec(node.name);
    if (heading) eachLine(node.from, node.to, `cm-md-heading cm-md-h${heading[1]}`);
    else if (node.name === 'Blockquote') eachLine(node.from, node.to, 'cm-md-quote');
    else if (node.name === 'FencedCode' || node.name === 'CodeBlock') {
      eachLine(node.from, node.to, 'cm-md-codeblock', true);
      if (node.name === 'FencedCode') fence(node);
      return false;
    } else if (node.name === 'Table') {
      eachLine(node.from, node.to, 'cm-md-table', true);
      return false;
    } else if (node.name === 'HorizontalRule') eachLine(node.from, node.to, 'cm-md-rule');
    else if (node.name === 'InlineCode') ranges.push(inlineCode.range(node.from, node.to));
    else if (node.name === 'ListItem') {
      const first = doc.lineAt(node.from);
      const indent = /^\s*/.exec(first.text)![0].length;
      ranges.push(listLine(indent, node.node.getChild('Task') !== null).range(first.from));
    } else if (node.name === 'Link') link(node);
    else if (node.name === 'TaskMarker' && node.to > node.from) {
      const checked = /x/i.test(doc.sliceString(node.from, node.to));
      const marker = node.node.parent?.parent?.getChild('ListMark');
      if (drawn(marker?.from ?? node.from, node.to))
        ranges.push(
          Decoration.replace({ widget: new CheckboxWidget(checked) }).range(node.from, node.to),
        );
      else ranges.push(task(checked).range(node.from, node.to));
    }
    const lineEnd = doc.lineAt(node.from).to;
    if (node.name === 'ListMark' && node.node.parent?.parent?.name === 'BulletList') {
      const item = node.node.parent;
      const task = item.getChild('Task')?.getChild('TaskMarker');
      if (!drawn(node.from, task?.to ?? node.to + 1)) return undefined;
      // The bullet replaces "- " so the text starts one em in, where the preview's does.
      if (task) ranges.push(hide.range(node.from, Math.min(node.to + after(node.to), lineEnd)));
      else ranges.push(bullet.range(node.from, Math.min(node.to + after(node.to), lineEnd)));
      return undefined;
    }
    if (!quiet(node.from)) return undefined;
    if (node.name === 'HeaderMark')
      ranges.push(hide.range(node.from, Math.min(node.to + after(node.to), lineEnd)));
    else if (node.name === 'QuoteMark')
      ranges.push(hide.range(node.from, Math.min(node.to + after(node.to), lineEnd)));
    else if (['EmphasisMark', 'StrikethroughMark'].includes(node.name))
      ranges.push(hide.range(node.from, node.to));
    else if (node.name === 'CodeMark' && node.node.parent?.name === 'InlineCode')
      ranges.push(hide.range(node.from, node.to));

    return undefined;
  };
  for (const { from, to } of view.visibleRanges) syntaxTree(state).iterate({ from, to, enter });
  const caret = state.selection.main;
  const caretLine = doc.lineAt(caret.head);
  const inCode = /Code/.test(syntaxTree(state).resolveInner(caret.head, -1).name);
  if (live && view.hasFocus && caret.empty && doc.length && !caretLine.text.trim() && !inCode)
    ranges.push(hint.range(caretLine.to));
  return Decoration.set(ranges, true);
};

export const markdownDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.focusChanged ||
        update.startState.facet(showSyntax) !== update.state.facet(showSyntax) ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      )
        this.decorations = build(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
