import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $draftState, $loadDraft } from '../editor-state.ts';
import type { ComposerEditorProps } from '../types.ts';
import { $getRoot, CLEAR_HISTORY_COMMAND, HISTORY_MERGE_TAG } from 'lexical';

export function useEditorSync(props: ComposerEditorProps, onCaret: (caret: number | null) => void) {
  const [editor] = useLexicalComposerContext();
  const last = useRef({ text: props.value, references: props.references });
  const callbacks = useRef({ onChange: props.onChange, onCaret });
  useEffect(() => {
    callbacks.current = { onChange: props.onChange, onCaret };
  }, [props.onChange, onCaret]);
  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
        editorState.read(() => {
          const state = $draftState();
          callbacks.current.onCaret(state.caret);
          if (!dirtyElements.size && !dirtyLeaves.size) return;
          if (
            state.text === last.current.text &&
            JSON.stringify(state.references) === JSON.stringify(last.current.references)
          )
            return;
          last.current = state;
          callbacks.current.onChange(state.text, state.references);
        });
      }),
    [editor],
  );
  useEffect(() => {
    if (
      props.value === last.current.text &&
      JSON.stringify(props.references) === JSON.stringify(last.current.references)
    )
      return;
    last.current = { text: props.value, references: props.references };
    const focused = document.activeElement === editor.getRootElement();
    editor.update(
      () => {
        $loadDraft(props.value, props.references);
        if (focused) $getRoot().selectEnd();
      },
      { tag: HISTORY_MERGE_TAG },
    );
    if (!props.value) editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
  }, [editor, props.value, props.references]);
  useEffect(() => {
    editor.setEditable(!props.disabled);
  }, [editor, props.disabled]);
  useEffect(
    () =>
      editor.registerRootListener((element) => {
        props.inputRef.current = element instanceof HTMLDivElement ? element : null;
      }),
    [editor, props.inputRef],
  );
  return editor;
}
