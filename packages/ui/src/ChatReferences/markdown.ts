import { parseFileCitation } from '@pitchcrew/core/chat-citations';
import type { ChatReference } from '@pitchcrew/core';
import { validChatReferences } from '@pitchcrew/core/chat-references';
interface Node {
  type: string;
  value?: string;
  url?: string;
  position?: { start: { offset?: number } };
  data?: Record<string, unknown>;
  children?: Node[];
}
/** Decorate validated mention occurrences and explicit app file links before HTML sanitization. */
export const referenceMarkdown = ({
  content,
  references,
}: {
  content: string;
  references: ChatReference[];
}) => {
  const valid = validChatReferences(content, references);
  return (tree: Node) => {
    const visit = (parent: Node) => {
      if (
        !parent.children ||
        ['code', 'inlineCode', 'link', 'linkReference', 'html'].includes(parent.type)
      )
        return;
      parent.children = parent.children.flatMap((node) => {
        if (node.type === 'link' && node.url && parseFileCitation(node.url)) {
          const label = node.children?.map((child) => child.value ?? '').join('') || 'File';
          return [
            {
              type: 'fileCitation',
              data: { hName: 'file-citation', hProperties: { url: node.url, label } },
              children: [{ type: 'text', value: label }],
            },
          ];
        }
        if (
          node.type !== 'text' ||
          node.value === undefined ||
          node.position?.start.offset === undefined
        ) {
          visit(node);
          return [node];
        }
        const offset = node.position.start.offset;
        const value = node.value;
        let cursor = 0;
        const result: Node[] = [];
        for (const ref of valid) {
          const start = ref.start - offset;
          if (
            start < cursor ||
            start < 0 ||
            value.slice(start, start + ref.token.length) !== ref.token
          )
            continue;
          result.push({ type: 'text', value: value.slice(cursor, start) });
          result.push({
            type: 'chatReference',
            data: { hName: 'chat-reference', hProperties: { index: references.indexOf(ref) } },
            children: [{ type: 'text', value: ref.token }],
          });
          cursor = start + ref.token.length;
        }
        if (!cursor) return [node];
        result.push({ type: 'text', value: value.slice(cursor) });
        return result;
      });
    };
    visit(tree);
  };
};
