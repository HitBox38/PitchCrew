import { useEffect } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COPY_COMMAND,
  CUT_COMMAND,
  PASTE_COMMAND,
  mergeRegister,
  type LexicalEditor,
} from 'lexical';
import {
  $getClipboardDataFromSelection,
  setLexicalClipboardDataTransfer,
  $insertDataTransferForRichText,
} from '@lexical/clipboard';

/** Keep atomic identity within Pitchcrew, and readable tokens when pasting elsewhere. */
export function useReferenceClipboard(editor: LexicalEditor) {
  useEffect(() => {
    function copy(event: ClipboardEvent | KeyboardEvent | null, cut = false) {
      if (!(event instanceof ClipboardEvent) || !event.clipboardData) return false;
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;
      event.preventDefault();
      setLexicalClipboardDataTransfer(
        event.clipboardData,
        $getClipboardDataFromSelection(selection),
      );
      if (cut) selection.removeText();
      return true;
    }
    return mergeRegister(
      editor.registerCommand(COPY_COMMAND, (event) => copy(event), COMMAND_PRIORITY_HIGH),
      editor.registerCommand(CUT_COMMAND, (event) => copy(event, true), COMMAND_PRIORITY_HIGH),
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (
            !(event instanceof ClipboardEvent) ||
            !event.clipboardData?.getData('application/x-lexical-editor')
          )
            return false;
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;
          event.preventDefault();
          $insertDataTransferForRichText(event.clipboardData, selection, editor);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor]);
}
