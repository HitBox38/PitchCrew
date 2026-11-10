import { useMarkdownView } from '../hooks/useMarkdownView.ts';
import type { MarkdownEditorProps } from '../types.ts';

/** The CodeMirror source editor; loaded on demand so other pages never pay for it. */
const MarkdownSurface = (props: MarkdownEditorProps) => {
  const host = useMarkdownView(props);
  return <div className="md-surface" ref={host} />;
};
export default MarkdownSurface;
