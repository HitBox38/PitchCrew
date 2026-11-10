import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import {
  blockLine,
  editorSpot,
  followSpot,
  placePreview,
  previewSpot,
  type ReadingBridge,
  type Spot,
} from '../reading.ts';
import type { MarkdownMode } from '../types.ts';

// Reading or navigating in a column makes it lead: focus covers the editor being moved by
// Outline, search or a citation from outside it.
const touches = ['wheel', 'pointerdown', 'touchstart', 'keydown', 'focusin'] as const;

/**
 * Follows the reader's scrolling: remembers where Write is (for switching modes), reports the
 * source line at the top of the view (Write or Preview), and in Split keeps the two columns at
 * the same block, led by whichever column the reader last touched.
 */
export const useScrollFollow = (options: {
  mode: MarkdownMode;
  write: RefObject<HTMLElement | null>;
  rendered: RefObject<HTMLElement | null>;
  reading: RefObject<ReadingBridge>;
  writeTop: RefObject<number>;
  writeSpot: RefObject<Spot | null>;
  onView?: (line: number) => void;
  documentKey?: string;
}) => {
  const { mode, write, rendered, reading, writeTop, writeSpot, onView, documentKey } = options;
  const report = useRef(onView);
  useLayoutEffect(() => {
    report.current = onView;
  });
  useEffect(() => {
    const source = write.current;
    const target = rendered.current;
    if (!source) return;
    let driver: 'write' | 'preview' = 'write';
    // Every scroll reports (React skips unchanged state), so a caret taking over and a later
    // scroll back to the same line both show.
    const tell = (line?: number) => {
      if (line) report.current?.(line);
    };
    const fromWrite = (event: Event) => {
      const scroller = event.target as HTMLElement;
      if (!scroller.classList?.contains('cm-scroller')) return;
      const view = reading.current.view;
      writeTop.current = scroller.scrollTop;
      writeSpot.current = view ? editorSpot(view) : null;
      tell(writeSpot.current?.line);
      if (mode !== 'split' || !target || driver !== 'write') return;
      const spot = writeSpot.current;
      if (!spot || !placePreview(target, spot, view)) target.scrollTop = scroller.scrollTop;
    };
    const fromPreview = () => {
      const view = reading.current.view;
      if (!view || !target) return;
      const spot = previewSpot(target, view);
      if (spot) tell(blockLine(view, spot.block));
      if (mode !== 'split' || driver !== 'preview') return;
      if (spot) followSpot(view, spot);
      else view.scrollDOM.scrollTop = target.scrollTop;
    };
    const leadWrite = () => (driver = 'write');
    const leadPreview = () => (driver = 'preview');
    source.addEventListener('scroll', fromWrite, true);
    target?.addEventListener('scroll', fromPreview, { passive: true });
    for (const type of touches) {
      source.addEventListener(type, leadWrite, { capture: true, passive: true });
      target?.addEventListener(type, leadPreview, { capture: true, passive: true });
    }
    return () => {
      source.removeEventListener('scroll', fromWrite, true);
      target?.removeEventListener('scroll', fromPreview);
      for (const type of touches) {
        source.removeEventListener(type, leadWrite, true);
        target?.removeEventListener(type, leadPreview, true);
      }
    };
    // A new note starts with Write leading again.
  }, [mode, write, rendered, reading, writeTop, writeSpot, documentKey]);
};
