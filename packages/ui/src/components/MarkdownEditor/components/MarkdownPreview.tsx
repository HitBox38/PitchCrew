import { createContext, use, type ComponentProps } from 'react';
import { MarkdownContent } from '@/components/MarkdownContent/index.tsx';
import { useTaskBoxes } from '../hooks/useTaskBoxes.ts';
import { toggleTaskAt } from '../tasks.ts';

/**
 * The rendered note. Text blocks use the editor's own type scale (md-* classes) rather than the
 * chat reading styles, so Write, Split and Preview show a note at the same sizes and rhythm.
 */
const MarkdownPreview = ({
  content,
  empty = 'Nothing to preview yet.',
  source = content,
  onChange,
}: {
  content: string;
  empty?: string;
  /** The current note text, when the preview may change it (ticking task boxes). */
  source?: string;
  onChange?: (content: string) => void;
}) => {
  const host = useTaskBoxes(content, source, !!onChange);
  return content.trim() ? (
    <ToggleTask value={onChange && { source, change: onChange }}>
      <div ref={host} className="md-preview-host">
        <p className="md-tasks-locked" role="note" hidden>
          Tasks in this note can't be ticked here, because one isn't a plain “- [ ]” box. Tick them
          in Write.
        </p>
        <MarkdownContent controls={false} components={components} className="md-rendered">
          {content}
        </MarkdownContent>
      </div>
    </ToggleTask>
  ) : (
    <p className="md-preview-empty">{empty}</p>
  );
};

/** The note behind the preview, for the rendered task boxes deep inside the Markdown tree. */
const ToggleTask = createContext<{ source: string; change: (content: string) => void } | undefined>(
  undefined,
);

/** A live task box: toggling it changes the source task it was linked to (`data-from`). */
const TaskBox = ({ checked }: { checked: boolean }) => {
  const note = use(ToggleTask);
  return (
    <input
      type="checkbox"
      className="md-task-box"
      checked={checked}
      onChange={(event) => {
        const from = event.currentTarget.dataset.from;
        if (note && from !== undefined) note.change(toggleTaskAt(note.source, Number(from)));
      }}
    />
  );
};
export default MarkdownPreview;

type Props<T extends keyof React.JSX.IntrinsicElements> = ComponentProps<T> & { node?: unknown };
const block =
  <T extends 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol' | 'li' | 'blockquote'>(tag: T) =>
  ({ node: _node, className: _className, ...props }: Props<T>) => {
    const Tag = tag as 'p';
    return <Tag className={`md-${tag}`} {...(props as ComponentProps<'p'>)} />;
  };

const components = {
  img: ({ alt }: { alt?: string }) => <span className="quiet">[Image: {alt || 'image'}]</span>,
  h1: block('h1'),
  h2: block('h2'),
  h3: block('h3'),
  h4: block('h4'),
  p: block('p'),
  ul: block('ul'),
  ol: block('ol'),
  li: block('li'),
  blockquote: block('blockquote'),
  hr: () => <hr className="md-hr" />,
  // Task boxes are live: a click toggles the task in the source (handled by the editor).
  input: ({ node: _node, ...props }: Props<'input'>) =>
    props.type === 'checkbox' ? <TaskBox checked={!!props.checked} /> : <input {...props} />,
};
