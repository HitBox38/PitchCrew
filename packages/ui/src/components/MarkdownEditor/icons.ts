import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Heading1, Heading2, Heading3 } from 'lucide-react';
import { blockTools, inlineTools } from './toolbar.ts';
import type { MarkdownFormat } from './types.ts';

const icons = new Map<string, typeof Heading1>([
  ['h1', Heading1],
  ['h2', Heading2],
  ['h3', Heading3],
  ...[...inlineTools, ...blockTools].map(([kind, , Icon]) => [kind, Icon] as const),
]);
const drawn = new Map<string, Element>();

/**
 * A toolbar icon as a plain DOM node, for CodeMirror's own menus. React draws each icon once;
 * later uses clone it.
 */
export const toolIcon = (kind: MarkdownFormat) => {
  let svg = drawn.get(kind);
  if (!svg) {
    const host = document.createElement('span');
    const root = createRoot(host);
    flushSync(() => root.render(createElement(icons.get(kind) ?? Heading1, { size: 16 })));
    svg = host.firstElementChild!.cloneNode(true) as Element;
    root.unmount();
    drawn.set(kind, svg);
  }
  return svg.cloneNode(true);
};
