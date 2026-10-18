import { useEffect } from 'react';
import {
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  PASTE_COMMAND,
  type LexicalEditor,
} from 'lexical';
import type { ComposerEditorProps } from '../types.ts';
import type { useSuggestions } from './useSuggestions.ts';
export function useEditorKeyboard(
  editor: LexicalEditor,
  props: ComposerEditorProps,
  suggestions: ReturnType<typeof useSuggestions>,
) {
  useEffect(
    () =>
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (event.isComposing || editor.isComposing()) return false;
          if (suggestions.open) {
            if (event.key === 'Escape') {
              event.preventDefault();
              suggestions.close();
              return true;
            }
            if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
              event.preventDefault();
              suggestions.move(event.key === 'ArrowDown' ? 1 : -1);
              return true;
            }
            if (
              ['Enter', 'Tab'].includes(event.key) &&
              !event.shiftKey &&
              !event.metaKey &&
              !event.ctrlKey
            ) {
              event.preventDefault();
              const selected = suggestions.items[suggestions.active];
              if (selected && !selected.disabled) suggestions.choose(selected);
              return true;
            }
          }
          if (event.key === 'Enter' && (!event.shiftKey || event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (!props.disabled) props.onSend((event.metaKey || event.ctrlKey) && event.shiftKey);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, props, suggestions],
  );
  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (!(event instanceof ClipboardEvent)) return false;
          const files = Array.from(event.clipboardData?.files ?? []);
          if (!files.length) return false;
          event.preventDefault();
          if (!props.disabled) props.onFiles(files);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, props],
  );
}
