import { markdownLanguage } from '@codemirror/lang-markdown';
import type { SyntaxNode } from '@lezer/common';

const tags: Record<string, keyof HTMLElementTagNameMap> = {
  Emphasis: 'em',
  StrongEmphasis: 'strong',
  Strikethrough: 'del',
  Link: 'span',
};
const marks = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'LinkMark',
  'URL',
  'LinkTitle',
  'LinkLabel',
]);

/** "&amp;" or "&#169;" as the character it names; unknown names stay as written. */
const entity = (text: string) => {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = text;
  return decoder.value;
};

/** A code span's text as CommonMark shows it: one surrounding space each side dropped. */
const codeText = (text: string) => {
  const flat = text.replace(/\n/g, ' ');
  return /^ .*[^ ].* $/.test(flat) ? flat.slice(1, -1) : flat;
};

const append = (source: string, node: SyntaxNode, into: Node) => {
  let at = node.from;
  const text = (to: number) => {
    if (to > at) into.appendChild(document.createTextNode(source.slice(at, to)));
  };
  for (let child = node.firstChild; child; child = child.nextSibling) {
    text(child.from);
    at = child.to;
    if (marks.has(child.name)) continue;
    if (child.name === 'Escape') {
      into.appendChild(document.createTextNode(source.slice(child.from + 1, child.to)));
    } else if (child.name === 'Entity') {
      into.appendChild(document.createTextNode(entity(source.slice(child.from, child.to))));
    } else if (child.name === 'Autolink') {
      const url = child.getChild('URL');
      const link = into.appendChild(document.createElement('span'));
      link.className = 'cm-md-cell-link';
      link.textContent = url ? source.slice(url.from, url.to) : '';
    } else if (child.name === 'InlineCode') {
      const code = into.appendChild(document.createElement('code'));
      code.textContent = codeText(
        source.slice(child.firstChild?.to ?? child.from, child.lastChild?.from),
      );
    } else if (tags[child.name]) {
      const element = into.appendChild(document.createElement(tags[child.name]));
      if (child.name === 'Link') element.className = 'cm-md-cell-link';
      append(source, child, element);
    } else {
      into.appendChild(document.createTextNode(source.slice(child.from, child.to)));
    }
  }
  text(node.to);
};

/**
 * One line of inline Markdown (a table cell) drawn as the reader sees it, read by the editor's
 * own parser: real emphasis, code and link text are drawn; literal characters such as the
 * underscores in snake_case or "1 * 2" stay exactly as written.
 */
export const renderInline = (text: string, into: HTMLElement) => {
  const source = text.replace(/\\\|/g, '|');
  const paragraph = markdownLanguage.parser.parse(source).topNode.firstChild;
  if (!paragraph || paragraph.name !== 'Paragraph' || paragraph.nextSibling)
    into.textContent = source;
  else append(source, paragraph, into);
};
