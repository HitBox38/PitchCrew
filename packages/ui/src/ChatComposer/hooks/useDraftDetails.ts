import { useState, type MouseEvent } from 'react';
import { $getNodeByKey, type LexicalEditor } from 'lexical';
import { ReferenceNode } from '../ReferenceNode.ts';
import type { ReferenceValue } from '@/ChatReferences/types.ts';

export const useDraftDetails = (editor: LexicalEditor) => {
  const inspect = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest<HTMLElement>('[data-reference-key]');
    if (!anchor?.dataset.referenceKey) return;
    const key = anchor.dataset.referenceKey;
    editor.getEditorState().read(() => {
      const node = $getNodeByKey(key);
      if (node instanceof ReferenceNode)
        setDetails({ anchor, key, reference: node.getReference() });
    });
  };
  const remove = () => {
    if (details) editor.update(() => $getNodeByKey(details.key)?.remove());
    close();
  };

  const [details, setDetails] = useState<{
    anchor: HTMLElement;
    key: string;
    reference: ReferenceValue;
  } | null>(null);
  const close = () => {
    setDetails(null);
    editor.focus();
  };
  return { details, inspect, remove, close };
};
