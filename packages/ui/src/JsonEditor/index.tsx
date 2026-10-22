import { useJsonEditor } from './hooks/useJsonEditor.ts';
import { EditorToolbar } from './components/EditorToolbar.tsx';
import type { JsonEditorProps } from './types.ts';
import { modKey } from '@/shortcuts.ts';

export const JsonEditor = (props: JsonEditorProps) => {
  const { host, format } = useJsonEditor(props);
  let invalid = false;
  try {
    JSON.parse(props.value);
  } catch {
    invalid = true;
  }
  return (
    <div className="json-editor">
      <EditorToolbar format={format} invalid={invalid} filename={props.filename} />
      <div className="json-editor-surface" ref={host} />
      <p id={`${props.id}-help`} className="json-editor-help text-xs text-muted-foreground">
        Tab to indent · Esc then Tab to leave · Ctrl+Space for suggestions · {modKey}S to save
      </p>
    </div>
  );
};
