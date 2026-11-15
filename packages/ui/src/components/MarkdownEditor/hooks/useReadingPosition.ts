import { useLayoutEffect, useRef, type RefObject } from 'react';
import {
  editorSpot,
  placePreview,
  previewSpot,
  type ReadingBridge,
  type Spot,
} from '../reading.ts';
import type { MarkdownMode } from '../types.ts';

const identity = (key: string) => key.split('#')[0];

/**
 * Places the preview at a reading place once its rendered note has caught up (lazy preview,
 * deferred text): tries each frame for about half a second, after `wait` frames for the editor
 * to settle, then falls back to a pixel offset. Returns a cancel function.
 */
const placeWhenReady = (
  preview: HTMLElement,
  reading: RefObject<ReadingBridge>,
  spot: () => Spot | null,
  fallback: number,
  {
    wait = 0,
    alive = () => true,
    done,
  }: { wait?: number; alive?: () => boolean; done?: () => void } = {},
) => {
  let frames = 0;
  let frame = requestAnimationFrame(function place() {
    // A newer note or mode took over: this placement no longer belongs here.
    if (!alive()) return;
    if (frames++ < wait) {
      frame = requestAnimationFrame(place);
      return;
    }
    const target = spot();
    const placed = !!target && placePreview(preview, target, reading.current.view);
    if (!placed && frames < wait + 30) {
      frame = requestAnimationFrame(place);
      return;
    }
    if (!placed) preview.scrollTop = fallback;
    // Done once that scroll has been delivered, so it is not taken for the reader's own.
    if (done)
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(done);
      });
  });
  return () => cancelAnimationFrame(frame);
};

/**
 * Keeps the reader's place across Write, Split and Preview, block by block and note by note:
 * Preview (or Split's preview) opens at the block, and offset within it, that topped Write;
 * Write reopens at the block the reader scrolled Preview to (`previewSpot`, read by the source
 * editor when it is shown again); each note keeps its own Preview place when the reader switches
 * notes. Pixel offsets stand in only when the two disagree on blocks.
 */
export const useReadingPosition = (
  mode: MarkdownMode,
  rendered: RefObject<HTMLElement | null>,
  documentKey = '',
) => {
  const reading = useRef<ReadingBridge>({ view: null, previewSpot: null });
  const writeTop = useRef(0);
  const writeSpot = useRef<Spot | null>(null);
  // Each note's Preview place, kept while the reader scrolls Preview.
  const places = useRef(new Map<string, Spot>());
  const shown = useRef(identity(documentKey));
  // Each placement belongs to one note and mode; scrolls it causes are not the reader's.
  const generation = useRef(0);
  const restoring = useRef(false);
  useLayoutEffect(() => {
    const note = identity(documentKey);
    if (note === shown.current) return;
    shown.current = note;
    const current = ++generation.current;
    reading.current.previewSpot = null;
    writeSpot.current = null;
    writeTop.current = 0;
    const preview = rendered.current;
    const fromEditor = () => {
      const view = reading.current.view;
      return view ? editorSpot(view) : null;
    };
    if (mode === 'write' || !preview) {
      // Write shows the note's own place; read it once the editor has restored it.
      const frame = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const view = reading.current.view;
          if (!view) return;
          writeTop.current = view.scrollDOM.scrollTop;
          writeSpot.current = editorSpot(view);
        }),
      );
      return () => cancelAnimationFrame(frame);
    }
    // Split: the preview follows Write's restored place. Preview: the note's own last place.
    const saved = places.current.get(note) ?? null;
    restoring.current = true;
    const cancel = placeWhenReady(
      preview,
      reading,
      mode === 'split' ? fromEditor : () => saved,
      0,
      {
        wait: mode === 'split' ? 2 : 0,
        alive: () => generation.current === current,
        done: () => (restoring.current = false),
      },
    );
    return () => {
      cancel();
      restoring.current = false;
    };
  }, [documentKey, mode, rendered]);
  useLayoutEffect(() => {
    const preview = rendered.current;
    if (mode === 'write' || !preview) return;
    reading.current.previewSpot = null;
    const spot = writeSpot.current;
    const current = ++generation.current;
    // Only the reader's own scrolling of this note's Preview counts.
    const listen = () => {
      if (restoring.current) return;
      const place = previewSpot(preview, reading.current.view);
      reading.current.previewSpot = place;
      if (place) places.current.set(shown.current, place);
    };
    restoring.current = true;
    if (mode === 'preview') preview.addEventListener('scroll', listen, { passive: true });
    const cancel = placeWhenReady(preview, reading, () => spot, writeTop.current, {
      alive: () => generation.current === current,
      done: () => (restoring.current = false),
    });
    return () => {
      cancel();
      restoring.current = false;
      preview.removeEventListener('scroll', listen);
    };
  }, [mode, rendered]);
  return { reading, writeTop, writeSpot };
};
