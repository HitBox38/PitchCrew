import { useId, useState } from 'react';
import { $getSelection, $isRangeSelection, $createTextNode, type LexicalEditor } from 'lexical';
import { chatTrigger } from '@pitchcrew/core/chat-references';
import { filterSuggestions } from '../helpers.ts';
import { $createReferenceNode } from '../ReferenceNode.ts';
import type { ComposerEditorProps, ComposerSuggestion } from '../types.ts';

export function useSuggestions(
  props: ComposerEditorProps,
  caret: number | null,
  editor: LexicalEditor,
) {
  const id = useId();
  const [activeState, setActive] = useState({ signature: '', index: 0 });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const trigger = caret === null ? null : chatTrigger(props.value, caret);
  const signature = trigger ? `${trigger.start}:${trigger.symbol}:${trigger.query}` : '';
  const items = trigger
    ? filterSuggestions(props.suggestions, trigger).map((item) =>
        item.reference?.kind === 'action' &&
        !/^\s*(?:@[a-z][a-z0-9-]*\s+)*$/.test(props.value.slice(0, trigger.start))
          ? { ...item, disabled: 'Use this action at the start of the message' }
          : item,
      )
    : [];
  const active =
    activeState.signature === signature
      ? Math.min(activeState.index, items.length - 1)
      : items.findIndex((item) => !item.disabled);
  const open = !!trigger && dismissed !== signature && !props.disabled;
  function choose(item: ComposerSuggestion) {
    if (!trigger || item.disabled) return;
    editor.update(() => {
      const selection = $getSelection();
      if (
        !$isRangeSelection(selection) ||
        !selection.isCollapsed() ||
        selection.anchor.type !== 'text'
      )
        return;
      const anchor = selection.anchor;
      selection.setTextNodeRange(
        anchor.getNode(),
        anchor.offset - ((caret ?? trigger.end) - trigger.start),
        anchor.getNode(),
        anchor.offset +
          trigger.end -
          (caret ?? trigger.end) +
          (props.value[trigger.end] === ' ' ? 1 : 0),
      );
      const reference = item.reference;
      selection.insertNodes(
        reference ? [$createReferenceNode(reference), $createTextNode(' ')] : [$createTextNode('')],
      );
    });
    setDismissed(signature);
    if (item.action) {
      if (item.action === 'skills') {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) selection.insertText('$');
        });
        setDismissed(null);
      } else props.onAction(item.action);
    }
    editor.focus();
  }
  function move(direction: number) {
    for (let step = 1; step <= items.length; step++) {
      const index = (Math.max(active, 0) + direction * step + items.length * 2) % items.length;
      if (!items[index]?.disabled) {
        setActive({ signature, index });
        break;
      }
    }
  }
  return { id, open, trigger, items, active, choose, move, close: () => setDismissed(signature) };
}
