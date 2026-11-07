import { useEffect, type RefObject } from 'react';
import type { ChatReference } from '@pitchcrew/core';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ReferenceNode } from '@/ChatComposer/ReferenceNode.ts';
import { $draftState, $loadDraft } from '@/ChatComposer/editor-state.ts';
import { useReferenceClipboard } from '@/ChatComposer/hooks/useReferenceClipboard.ts';

type EditorProps = {
  content: string;
  references: ChatReference[];
  disabled: boolean;
  inputRef: RefObject<HTMLDivElement | null>;
  onChange: (content: string, references: ChatReference[]) => void;
};

const QueuedEditorSurface = ({ disabled, inputRef, onChange }: EditorProps) => {
  const [editor] = useLexicalComposerContext();
  useReferenceClipboard(editor);
  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);
  return (
    <>
      <PlainTextPlugin
        ErrorBoundary={LexicalErrorBoundary}
        contentEditable={
          <ContentEditable
            ref={inputRef}
            className="chat-queued-editor-input chat-rich-input"
            aria-label="Queued message"
            aria-multiline="true"
          />
        }
      />
      <OnChangePlugin
        ignoreSelectionChange
        onChange={(state) =>
          state.read(() => {
            const draft = $draftState();
            onChange(draft.text, draft.references);
          })
        }
      />
      <HistoryPlugin />
    </>
  );
};

/** The existing reference nodes and canonical text preserve newlines and atomic identities. */
export const QueuedComposerEditor = (props: EditorProps) => (
  <LexicalComposer
    initialConfig={{
      namespace: 'pitchcrew-chat',
      nodes: [ReferenceNode],
      editable: !props.disabled,
      editorState: () => $loadDraft(props.content, props.references),
      onError: (error) => {
        throw error;
      },
    }}
  >
    <QueuedEditorSurface {...props} />
  </LexicalComposer>
);
