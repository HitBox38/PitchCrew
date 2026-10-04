/**
 * Convert job description HTML to plain text with a single linear scan. Nothing is parsed into a
 * DOM, rendered, executed or fetched: tags are dropped, link targets are discarded and the
 * contents of script, style and similar elements are skipped.
 */
const maxInput = 400_000;
const maxOutput = 20_000;
const skipped = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'head',
  'iframe',
  'object',
  'svg',
]);
const blocks = new Set([
  'p',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'ul',
  'ol',
  'table',
  'tr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'hr',
]);
const named: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  hellip: '...',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  bull: '-',
  middot: '-',
  copy: '(c)',
  reg: '(R)',
  trade: '(TM)',
  euro: 'EUR',
  pound: 'GBP',
  times: 'x',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      // Drop control characters, surrogates and out-of-range code points.
      if (
        !Number.isFinite(code) ||
        code > 0x10ffff ||
        (code >= 0xd800 && code <= 0xdfff) ||
        (code < 0x20 && code !== 0x09 && code !== 0x0a)
      )
        return ' ';
      return String.fromCodePoint(code);
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function tagName(tag: string): { name: string; closing: boolean } {
  const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)/i.exec(tag);
  return { name: match?.[2]?.toLowerCase() ?? '', closing: match?.[1] === '/' };
}

export function htmlToText(input: string): string {
  let html = input.slice(0, maxInput);
  // Greenhouse returns entity-escaped HTML ("&lt;p&gt;"). Unescape once before reading tags.
  if (!html.includes('<') && /&lt;\/?[a-z]/i.test(html)) html = decodeEntities(html);
  let output = '';
  let skipping = '';
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    const text = open === -1 ? html.slice(index) : html.slice(index, open);
    if (!skipping) output += text;
    if (open === -1) break;
    if (html.startsWith('<!--', open)) {
      const end = html.indexOf('-->', open + 4);
      index = end === -1 ? html.length : end + 3;
      continue;
    }
    const close = html.indexOf('>', open + 1);
    if (close === -1) break;
    const { name, closing } = tagName(html.slice(open, close + 1));
    index = close + 1;
    if (skipping) {
      if (closing && name === skipping) skipping = '';
      continue;
    }
    if (!closing && skipped.has(name) && !html.slice(open, close + 1).endsWith('/>')) {
      skipping = name;
      continue;
    }
    if (name === 'br') output += '\n';
    else if (name === 'li') output += closing ? '' : '\n- ';
    else if (name === 'td' || name === 'th') output += closing ? ' ' : '';
    else if (blocks.has(name)) output += '\n\n';
    if (output.length > maxOutput * 2) break;
  }
  return cleanText(decodeEntities(output));
}
/** Normalize plain text: no markup handling, only whitespace and length. */
export function cleanText(value: string): string {
  return value
    .slice(0, maxInput)
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v \u00a0]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxOutput);
}
