import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  type LexicalNode,
} from 'lexical';
import type { ChatReference } from '@pitchcrew/core';
import { ReferenceNode, $createReferenceNode } from './ReferenceNode.ts';

export function $draftState() {
  const root = $getRoot();
  const text = root.getTextContent();
  const references: ChatReference[] = [];
  let offset = 0;
  let caret: number | null = null;
  const selection = $getSelection();
  function walk(node: LexicalNode) {
    if (
      $isRangeSelection(selection) &&
      selection.isCollapsed() &&
      selection.anchor.key === node.getKey()
    ) {
      caret =
        offset +
        ($isTextNode(node)
          ? selection.anchor.offset
          : $isElementNode(node)
            ? node
                .getChildren()
                .slice(0, selection.anchor.offset)
                .reduce((sum, child) => sum + child.getTextContentSize(), 0)
            : 0);
    }
    if ($isElementNode(node)) {
      const children = node.getChildren();
      children.forEach((child, index) => {
        walk(child);
        if (node === root && index < children.length - 1) offset += 2;
      });
    } else {
      if (node instanceof ReferenceNode)
        references.push({
          ...node.getReference(),
          start: offset,
          end: offset + node.getTextContentSize(),
        });
      offset += node.getTextContentSize();
    }
  }
  walk(root);
  if ($isRangeSelection(selection) && selection.anchor.getNode() instanceof ReferenceNode)
    caret = null;
  return { text, references, caret };
}
export function $loadDraft(text: string, references: ChatReference[]) {
  const root = $getRoot();
  root.clear();
  const paragraph = $createParagraphNode();
  root.append(paragraph);
  let cursor = 0;
  function append(value: string) {
    value.split('\n').forEach((line, index) => {
      if (index) paragraph.append($createLineBreakNode());
      if (line) paragraph.append($createTextNode(line));
    });
  }
  for (const ref of references.toSorted((a, b) => a.start - b.start)) {
    if (ref.start < cursor || text.slice(ref.start, ref.end) !== ref.token) continue;
    append(text.slice(cursor, ref.start));
    paragraph.append($createReferenceNode(ref));
    cursor = ref.end;
  }
  append(text.slice(cursor));
}
