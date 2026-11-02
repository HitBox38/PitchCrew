import { parseDocument, visit } from 'yaml';

const heading = /^heading ("(?:[^"\\]|\\.)*") \[level=[1-6]\]$/;
const treeLine = /^\s*- (?:heading .* \[level=\d+\]|(?:paragraph|list|listitem|text):)/m;
const extractionError = () =>
  new Error(
    'The description contains browser extraction syntax that could not be converted safely. ' +
      'Read the inspected posting again and supply its full original wording as readable text, ' +
      'with separate headings, paragraphs and bullet lists. Do not summarize, invent or truncate it.',
  );

/**
 * Convert only an evidenced ARIA excerpt at the browser import boundary. The browser snapshot
 * remains untouched: it is inspection/approval evidence, not a user-facing document format.
 * Unknown nodes or malformed YAML fail rather than dropping source text.
 */
export const browserJobDescription = (description: string, evidence: string): string => {
  const start = description.search(treeLine);
  if (start < 0) return description;
  const prefix = description.slice(0, start);
  const source = description.slice(start);
  // A literal mention of an extraction token is not enough to reinterpret ordinary prose.
  const structural =
    /^\s*- heading .* \[level=\d+\]/m.test(source) ||
    (/^\s*- list:/m.test(source) && /^\s*- listitem:/m.test(source));
  const inspectedLines = new Set(evidence.split('\n').map((line) => line.trim()));
  const evidenced = source
    .split('\n')
    .every((line) => !line.trim() || inspectedLines.has(line.trim()));
  if (!structural && !evidenced) return description;
  if (!evidenced) throw extractionError();
  if (prefix.split('\n').some((line) => /^\s*- /.test(line) && inspectedLines.has(line.trim())))
    throw extractionError();
  try {
    const document = parseDocument(source, { schema: 'failsafe' });
    if (document.errors.length || document.warnings.length) throw extractionError();
    // Comments, tags and anchors are not posting nodes. Never let YAML silently discard them.
    if (document.comment || document.commentBefore) throw extractionError();
    visit(document, {
      Node: (_key, node, path) => {
        if (
          path.length > 40 ||
          node.comment ||
          node.commentBefore ||
          node.tag ||
          ('anchor' in node && node.anchor)
        )
          throw extractionError();
      },
    });
    const nodes: unknown = document.toJS({ maxAliasCount: 0 });
    const text = renderNodes(nodes, 0);
    return [prefix.trimEnd(), text].filter(Boolean).join('\n\n');
  } catch {
    throw extractionError();
  }
};

const renderNodes = (nodes: unknown, depth: number, list = false): string => {
  if (!Array.isArray(nodes) || depth > 20) throw extractionError();
  return nodes
    .map((node: unknown) => {
      if (typeof node === 'string') {
        const match = heading.exec(node);
        if (!match || list) throw extractionError();
        return JSON.parse(match[1]!) as string;
      }
      if (!node || typeof node !== 'object' || Array.isArray(node)) throw extractionError();
      const entries = Object.entries(node);
      if (entries.length !== 1) throw extractionError();
      const [role, value] = entries[0]!;
      if (role === 'list' && !list) return renderNodes(value, depth + 1, true);
      if (role === 'listitem' && list && typeof value === 'string') return `- ${value}`;
      if ((role === 'paragraph' || role === 'text') && !list && typeof value === 'string')
        return value;
      throw extractionError();
    })
    .join(list ? '\n' : '\n\n');
};
