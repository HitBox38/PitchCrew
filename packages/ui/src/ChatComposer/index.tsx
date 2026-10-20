import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ReferenceNode } from './ReferenceNode.ts';
import { EditorSurface } from './components/EditorSurface.tsx';
import { $loadDraft } from './editor-state.ts';
import type { ComposerEditorProps } from './types.ts';

export const ChatComposerEditor = (props: ComposerEditorProps) => {
  return (
    <LexicalComposer
      key={props.thread}
      initialConfig={{
        namespace: 'pitchcrew-chat',
        nodes: [ReferenceNode],
        editable: !props.disabled,
        onError: (error) => {
          throw error;
        },
        editorState: () => $loadDraft(props.value, props.references),
      }}
    >
      <EditorSurface {...props} />
      <HistoryPlugin />
    </LexicalComposer>
  );
};
