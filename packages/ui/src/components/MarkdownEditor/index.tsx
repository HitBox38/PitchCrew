import { lazy, Suspense, useDeferredValue, useRef } from 'react';
import { useReadingPosition } from './hooks/useReadingPosition.ts';
import { useScrollFollow } from './hooks/useScrollFollow.ts';
import type { MarkdownEditorProps } from './types.ts';

const MarkdownSurface = lazy(() => import('./components/MarkdownSurface.tsx'));
const MarkdownPreview = lazy(() => import('./components/MarkdownPreview.tsx'));

/** Lines the size of the note while the editor loads, so the sheet never jumps. */
const SurfaceLoading = ({ content }: { content: string }) => (
  <pre className="md-loading" aria-hidden="true">
    {content}
  </pre>
);

/**
 * Shared Profile and Skill document editor: the Markdown source, its rendered preview, or both
 * side by side. One source editor stays mounted across modes and documents; switching modes
 * keeps the reader's place, and in Split the columns follow each other block by block.
 */
export const MarkdownEditor = (props: MarkdownEditorProps) => {
  // Preview renders a step behind typing so long notes never slow the editor.
  const preview = useDeferredValue(props.content);
  const write = useRef<HTMLDivElement>(null);
  const rendered = useRef<HTMLElement>(null);
  const { reading, writeTop, writeSpot } = useReadingPosition(
    props.mode,
    rendered,
    props.documentKey,
  );
  useScrollFollow({
    mode: props.mode,
    write,
    rendered,
    reading,
    writeTop,
    writeSpot,
    onView: props.onView,
    documentKey: props.documentKey,
  });
  return (
    <div className="md-editor" data-mode={props.mode}>
      <div className="md-write" ref={write} hidden={props.mode === 'preview'}>
        <Suspense fallback={<SurfaceLoading content={props.content} />}>
          <MarkdownSurface {...props} reading={reading} />
        </Suspense>
      </div>
      {props.mode === 'write' ? null : (
        <section
          className="md-preview"
          ref={rendered}
          aria-label={`${props.label} preview`}
          data-private=""
        >
          <Suspense fallback={<p className="quiet">Opening preview…</p>}>
            <MarkdownPreview
              content={preview}
              source={props.content}
              onChange={props.disabled ? undefined : props.onChange}
            />
          </Suspense>
        </section>
      )}
    </div>
  );
};
