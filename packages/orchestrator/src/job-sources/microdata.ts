import { serialize, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const attr = (node: Element, name: string) => node.attrs.find((item) => item.name === name)?.value;
const skipped = new Set(['script', 'style', 'template', 'noscript']);

function scope(root: Element, depth = 0): Record<string, unknown> {
  const values = new Map<string, unknown[]>();
  const nodes: Node[] = [...root.childNodes].reverse();
  if (depth > 12) return {};
  while (nodes.length) {
    const node = nodes.pop()!;
    if (!('tagName' in node) || skipped.has(node.tagName)) continue;
    const properties = (attr(node, 'itemprop') ?? '').split(/\s+/).filter(Boolean);
    const nested = attr(node, 'itemscope') !== undefined;
    if (properties.length) {
      const value = nested
        ? scope(node, depth + 1)
        : (attr(node, 'content') ?? attr(node, 'datetime') ?? serialize(node));
      for (const property of properties) {
        const entries = values.get(property) ?? [];
        entries.push(value);
        values.set(property, entries);
      }
    }
    if (!nested) nodes.push(...[...node.childNodes].reverse());
  }
  return Object.fromEntries(
    [...values].map(([key, entries]) => [key, entries.length === 1 ? entries[0] : entries]),
  );
}

/** Read schema.org microdata only; nested organizations and addresses retain their scopes. */
export function microdataJobPostings(root: Node) {
  const nodes: Node[] = [root];
  const postings: Record<string, unknown>[] = [];
  while (nodes.length) {
    const node = nodes.pop()!;
    if ('tagName' in node) {
      if (skipped.has(node.tagName)) continue;
      if (
        (attr(node, 'itemtype') ?? '')
          .split(/\s+/)
          .some((type) => /^https?:\/\/schema\.org\/JobPosting$/.test(type))
      )
        postings.push(scope(node));
    }
    if ('childNodes' in node) nodes.push(...node.childNodes);
  }
  return postings;
}
