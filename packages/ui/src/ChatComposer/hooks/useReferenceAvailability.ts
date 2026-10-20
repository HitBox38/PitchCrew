import { useEffect } from 'react';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey } from 'lexical';
import type { ComposerSuggestion } from '../types.ts';
import { ReferenceNode } from '../ReferenceNode.ts';
export const useReferenceAvailability = (
  editor: LexicalEditor,
  suggestions: ComposerSuggestion[],
) => {
  useEffect(() => {
    editor.getEditorState().read(() => {
      for (const element of editor
        .getRootElement()
        ?.querySelectorAll<HTMLElement>('[data-reference-key]') ?? []) {
        const node = $getNodeByKey(element.dataset.referenceKey!);
        if (!(node instanceof ReferenceNode)) continue;
        const ref = node.getReference();
        const matching = suggestions.find(
          (item) =>
            item.reference?.kind === ref.kind &&
            item.reference.id === ref.id &&
            (!ref.revision || item.reference.revision === ref.revision),
        );
        element.toggleAttribute('data-unavailable', !matching || !!matching.disabled);
      }
    });
  }, [editor, suggestions]);
};
