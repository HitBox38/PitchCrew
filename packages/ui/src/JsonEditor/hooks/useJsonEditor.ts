import { useEffect, useLayoutEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { forceLinting } from '@codemirror/lint';
import { isolateHistory } from '@codemirror/commands';
import { editorExtensions, refreshJsonDiagnostics } from '../extensions.ts';
import { formatJson } from '../commands.ts';
import type { JsonEditorProps } from '../types.ts';
import { editorText, jsonLineEndings, lineEnding } from '../line-endings.ts';

export const useJsonEditor = (props: JsonEditorProps) => {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const syncing = useRef(false);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: editorText(latest.current.value),
        extensions: editorExtensions(
          latest.current,
          (value) => {
            if (!syncing.current) latest.current.onChange(value);
          },
          () => latest.current,
        ),
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    if (editor.state.sliceDoc() !== props.value) {
      syncing.current = true;
      try {
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: editorText(props.value) },
          effects: jsonLineEndings.reconfigure(
            EditorState.lineSeparator.of(lineEnding(props.value)),
          ),
          annotations: isolateHistory.of('full'),
        });
      } finally {
        syncing.current = false;
      }
    }
    // Stale daemon results must never decorate a newer draft.
    editor.dispatch({ effects: refreshJsonDiagnostics.of(null) });
    forceLinting(editor);
    editor.contentDOM.setAttribute('aria-invalid', String(props.issues.length > 0));
  }, [props.value, props.issues]);
  const format = () => {
    if (view.current) {
      formatJson(view.current);
      view.current.focus();
    }
  };
  return { host, format };
};
