import { useEffect, useRef, useState } from 'react';
import { readGutters } from '../gutters.ts';
export const findTextRanges = (
  root: HTMLElement,
  query: string,
  matchCase: boolean,
  wholeWord: boolean,
): Range[] => {
  if (!query) return [];
  const nodes: Text[] = [];
  const offsets: number[] = [];
  let text = '';
  // Viewer chrome (thumbnails, outline) is not document text; blocks and line breaks are
  // boundaries, so a match never runs from one paragraph, line or page into the next.
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) =>
        (node instanceof Element ? node : node.parentElement)?.closest(ignored)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    },
  );
  // A boundary falls wherever the enclosing block changes (entering or leaving one) or at a <br>.
  let lineBreak = false;
  let previous: Element | null | undefined;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType !== Node.TEXT_NODE) {
      if ((node as Element).tagName === 'BR') lineBreak = true;
      continue;
    }
    const block = node.parentElement?.closest(blocks);
    if (text && (lineBreak || block !== previous)) text += '\n';
    lineBreak = false;
    previous = block;
    offsets.push(text.length);
    nodes.push(node as Text);
    text += (node as Text).data;
  }
  // Case folding may change string length (for example İ), so match original offsets.
  const expression = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    matchCase ? 'gu' : 'giu',
  );
  const ranges: Range[] = [];
  for (const match of text.matchAll(expression)) {
    const offset = match.index;
    if (
      wholeWord &&
      (/[\p{L}\p{N}_]/u.test(text[offset - 1] ?? '') ||
        /[\p{L}\p{N}_]/u.test(text[offset + match[0].length] ?? ''))
    )
      continue;
    const start = offsets.findLastIndex((position) => position <= offset);
    const endOffset = offset + match[0].length;
    const end = offsets.findLastIndex((position) => position < endOffset);
    if (start < 0 || end < 0) continue;
    const range = root.ownerDocument.createRange();
    range.setStart(nodes[start]!, offset - offsets[start]!);
    range.setEnd(nodes[end]!, endOffset - offsets[end]!);
    ranges.push(range);
  }
  return ranges;
};
const ignored = '[data-find-ignore], script, style, button, [aria-hidden="true"]';
/** Elements whose edges end a run of text: blocks, table cells, list items and PDF pages' layers. */
const blocks =
  'p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, pre, table, tr, td, th, section, article, header, footer, dd, dt';
export const useDocumentFind = (root: HTMLElement | null, identity: string) => {
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const key = `${identity}:${query}:${matchCase}:${wholeWord}`;
  const [result, setResult] = useState<{ root: HTMLElement; key: string; ranges: Range[] } | null>(
    null,
  );
  const ranges = result?.root === root && result?.key === key ? result.ranges : emptyRanges;
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  /** The match last scrolled to, so recomputed ranges never yank the reader back to it. */
  const scrolled = useRef('');
  /** The last search run, so reopening Find with it keeps the reader's match. */
  const searched = useRef('');
  useEffect(() => {
    if (!root) {
      // Reopening Find brings the active match back into view.
      scrolled.current = '';
      return;
    }
    let settle: ReturnType<typeof setTimeout> | undefined;
    let accepted = 0;
    // A new search starts at its first match. Files are frozen, so later changes are re-renders:
    // PDF text layers arriving, or zoom emptying and refilling every page. Matches only grow
    // while layers arrive; a dip means pages are mid-swap, so the reader's place is kept until
    // the document has been quiet long enough to accept it.
    const update = (mode: 'fresh' | 'change' | 'settled') => {
      const found = findTextRanges(root, query, matchCase, wholeWord);
      if (mode === 'change' && found.length < accepted) {
        settle = setTimeout(() => update('settled'), 1000);
        return;
      }
      accepted = found.length;
      setResult({ root, key, ranges: found });
      setIndex((current) =>
        mode === 'fresh' ? 0 : found.length ? Math.min(current, found.length - 1) : current,
      );
    };
    // Reopening Find on the same search keeps the active match instead of starting over.
    update(searched.current === key ? 'change' : 'fresh');
    searched.current = key;
    const observer = new MutationObserver(() => {
      clearTimeout(settle);
      settle = setTimeout(() => update('change'), 150);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      clearTimeout(settle);
      observer.disconnect();
    };
  }, [root, key, query, matchCase, wholeWord]);
  useEffect(() => {
    const view = root?.ownerDocument.defaultView;
    if (!view || !('Highlight' in view)) return;
    const registry = view.CSS.highlights;
    registry.set('file-matches', new view.Highlight(...ranges));
    const active = ranges[index];
    registry.set('file-active-match', new view.Highlight(...(active ? [active] : [])));
    const target = `${key}:${index}`;
    if (active && scrolled.current !== target) {
      scrolled.current = target;
      // A match already in view stays put, clear of the floating Find and page pills.
      if (!inView(active)) reveal(active);
    }
    return () => {
      registry.delete('file-matches');
      registry.delete('file-active-match');
    };
  }, [root, ranges, index, key]);
  return {
    query,
    setQuery,
    matchCase,
    setMatchCase,
    wholeWord,
    setWholeWord,
    attachInput: (element: HTMLInputElement | null) => {
      input.current = element;
    },
    focus: () => input.current?.focus(),
    /** The active match, so zoom can keep it in place. */
    active: () => ranges[index],
    count: ranges.length,
    index: ranges.length ? index + 1 : 0,
    next: (direction: number) =>
      setIndex((current) =>
        ranges.length ? (current + direction + ranges.length) % ranges.length : 0,
      ),
  };
};
export type DocumentFind = ReturnType<typeof useDocumentFind>;
/**
 * Scrolls the match itself (not its whole element, which in Source is one long `pre`) to the
 * middle of its scrolling view, and sideways into a horizontally scrolling line if needed.
 */
const reveal = (range: Range) => {
  const rect = range.getBoundingClientRect();
  const owner = range.startContainer.ownerDocument;
  const view = owner?.defaultView;
  const body = range.startContainer.parentElement?.closest('.file-view-body');
  const scroller = body ?? owner?.scrollingElement;
  if (!scroller || !view) return;
  const box = body?.getBoundingClientRect() ?? {
    top: 0,
    left: 0,
    width: view.innerWidth,
    height: view.innerHeight,
  };
  scroller.scrollTop += rect.top + rect.height / 2 - (box.top + box.height / 2);
  const line = range.startContainer.parentElement?.closest('.file-text-document');
  const across = line && line.scrollWidth > line.clientWidth ? line : scroller;
  const lane = across.getBoundingClientRect();
  if (rect.left < lane.left || rect.right > lane.right)
    across.scrollLeft += rect.left + rect.width / 2 - (lane.left + lane.width / 2);
};
/**
 * Whether a match sits inside its scrolling view, clear of the pills over its top and bottom: the
 * tray's CSS gutters are sized to clear them (and shrink on phones, where Find docks above).
 */
const inView = (range: Range) => {
  const rect = range.getBoundingClientRect();
  const scroller = range.startContainer.parentElement?.closest('.file-view-body');
  const view = range.startContainer.ownerDocument?.defaultView;
  // A Word match lives in the preview frame: measure the frame's viewport, with the gutters the
  // frame inherits from the tray.
  const box = scroller?.getBoundingClientRect() ?? { top: 0, bottom: view?.innerHeight ?? 0 };
  const host = scroller ?? view?.frameElement;
  const gutter = host ? readGutters(host) : { top: 0, bottom: 0 };
  // Unwrapped Source lines scroll sideways: the match must be inside that lane too.
  const line = range.startContainer.parentElement?.closest('.file-text-document');
  const lane =
    line && line.scrollWidth > line.clientWidth
      ? line.getBoundingClientRect()
      : (scroller?.getBoundingClientRect() ?? { left: 0, right: view?.innerWidth ?? 0 });
  return (
    rect.height > 0 &&
    rect.top >= box.top + gutter.top &&
    rect.bottom <= box.bottom - gutter.bottom &&
    rect.left >= lane.left &&
    rect.right <= lane.right
  );
};
const emptyRanges: Range[] = [];
