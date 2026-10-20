import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Card, ExtractedJob } from '@pitchcrew/core';
import { cleanText, decodeEntities } from '../../job-sources/html.ts';
const textWithin = (root: Node) => {
  const stack = [root];
  let text = '';
  while (stack.length && text.length < 2000) {
    const node = stack.pop()!;
    if ('value' in node && node.nodeName === '#text') text += node.value;
    else stack.push(...children(node).toReversed());
  }
  return cleanText(text).slice(0, 2000);
};
const selectorKey = (selector: string) => {
  const match = /^([a-z][\w-]*)?(?:([.#])([\w-]+))?$/i.exec(selector);
  return match && (match[1] || match[2])
    ? `${match[1]?.toLowerCase() ?? ''}${match[2] ?? ''}${match[3] ?? ''}`
    : null;
};
const hiddenBySelector = (selectors: Set<string>, tag: string, attrs: Map<string, string>) => {
  if (selectors.has(tag)) return true;
  const id = attrs.get('id');
  if (id && (selectors.has(`#${id}`) || selectors.has(`${tag}#${id}`))) return true;
  return (attrs.get('class') ?? '')
    .split(/\s+/)
    .some((name) => selectors.has(`.${name}`) || selectors.has(`${tag}.${name}`));
};
/** No scripts, resources or CSS are executed. All remaining visibility stays unknown. */
export const applicationSource = (card: Pick<Card, 'description' | 'sourceHtml'>) => {
  if (!card.sourceHtml) return { text: card.description, flagged: [] as ExtractedJob['flagged'] };
  let html = card.sourceHtml.slice(0, 400000);
  // Some providers return entity-escaped markup; decode once before examining hiding evidence.
  if (!html.includes('<') && /&lt;\/?[a-z]/i.test(html)) html = decodeEntities(html);
  const document = parse(html);
  const selectors = new Set<string>();
  const pending = [document as Node];
  while (pending.length) {
    const node = pending.pop()!;
    if ('tagName' in node && node.tagName === 'style') {
      const css = textWithin(node).replace(/\/\*[\s\S]*?\*\//g, '');
      for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
        if (hiding.test(rule[2]!))
          for (const selector of rule[1]!.split(',')) {
            const key = selectorKey(selector.trim());
            if (key) selectors.add(key);
          }
    }
    pending.push(...children(node));
  }
  const flagged: ExtractedJob['flagged'] = [];
  const stack = [document as Node];
  let text = '';
  while (stack.length) {
    const node = stack.pop()!;
    if ('tagName' in node) {
      if (dropped.has(node.tagName)) continue;
      const attrs = new Map(node.attrs.map((attr) => [attr.name, attr.value]));
      if (
        attrs.has('hidden') ||
        hiding.test(attrs.get('style') ?? '') ||
        hiddenBySelector(selectors, node.tagName, attrs)
      ) {
        const excerpt = textWithin(node);
        if (excerpt && flagged.length < 30)
          flagged.push({
            text: excerpt,
            reason:
              'Excluded because captured markup uses hiding attributes or styles. Rendered visibility is not established.',
          });
        continue;
      }
      text += '\n';
    }
    if ('value' in node && node.nodeName === '#text') text += node.value;
    stack.push(...children(node).toReversed());
  }
  return { text: cleanText(text), flagged };
};

type Node = DefaultTreeAdapterMap['node'];
const children = (node: Node): Node[] => ('childNodes' in node ? node.childNodes : []);
const hiding =
  /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?|font-size\s*:\s*0(?:\.0+)?(?:px|em|rem|pt|%)?)\s*(?:!important\s*)?(?:;|$)/i;
const dropped = new Set(['script', 'style', 'template', 'noscript', 'iframe', 'object', 'svg']);
