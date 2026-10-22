import { useEffect, useRef, useState } from 'react';
export const findTextRanges = (
  root: HTMLElement,
  query: string,
  matchCase: boolean,
  wholeWord: boolean,
): Range[] => {
  if (!query) return [];
  const nodes: Text[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('[data-find-ignore], script, style, button, [aria-hidden="true"]')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const offsets: number[] = [];
  let text = '';
  for (const node of nodes) {
    offsets.push(text.length);
    text += node.data;
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
  useEffect(() => {
    if (!root) {
      return;
    }
    const update = () => {
      setResult({ root, key, ranges: findTextRanges(root, query, matchCase, wholeWord) });
      setIndex(0);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [root, key, query, matchCase, wholeWord]);
  useEffect(() => {
    const view = root?.ownerDocument.defaultView;
    if (!view || !('Highlight' in view)) return;
    const registry = view.CSS.highlights;
    registry.set('file-matches', new view.Highlight(...ranges));
    const active = ranges[index];
    registry.set('file-active-match', new view.Highlight(...(active ? [active] : [])));
    if (active)
      (active.startContainer.parentElement ?? root)?.scrollIntoView({
        block: 'center',
        inline: 'nearest',
      });
    return () => {
      registry.delete('file-matches');
      registry.delete('file-active-match');
    };
  }, [root, ranges, index]);
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
    count: ranges.length,
    index: ranges.length ? index + 1 : 0,
    next: (direction: number) =>
      setIndex((current) =>
        ranges.length ? (current + direction + ranges.length) % ranges.length : 0,
      ),
  };
};
export type DocumentFind = ReturnType<typeof useDocumentFind>;
const emptyRanges: Range[] = [];
