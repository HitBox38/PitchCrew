import { useRef, type RefObject } from 'react';
import { scrollerOf } from '../scroller.ts';

interface Anchor {
  element: Element;
  /** How far down and across the element the reading point sat, so it scales with it. */
  fraction: number;
  across: number;
  /** Where the reading point sat in the visible area. */
  offset: number;
  offsetX: number;
  scroller: Element;
  /** Where the last restore left the scroll, so a reader's own scroll is never undone. */
  restored?: number;
  /** The view's rotation when captured: images and PDF pages turn under the reader. */
  rotation: number;
}
type Point = { across: number; down: number };
/** A point on a turned box (fractions across/down) as the same point on the unturned content. */
const unturn = ({ across, down }: Point, rotation: number): Point =>
  rotation === 90
    ? { across: down, down: 1 - across }
    : rotation === 180
      ? { across: 1 - across, down: 1 - down }
      : rotation === 270
        ? { across: 1 - down, down: across }
        : { across, down };
/** A point on unturned content as fractions of the box it occupies once turned. */
const turn = ({ across, down }: Point, rotation: number): Point =>
  rotation === 90
    ? { across: 1 - down, down: across }
    : rotation === 180
      ? { across: 1 - across, down: 1 - down }
      : rotation === 270
        ? { across: down, down: 1 - across }
        : { across, down };
/** Content that turns with the view's rotation. */
const turning = 'img, [data-page]';
/** Blocks that scale with zoom: PDF pages, Word pages and Markdown/text blocks. */
const blocks = '[data-page], section.docx, p, li, h1, h2, h3, h4, h5, h6, pre, tr, blockquote';

/**
 * Keeps the reader's place through zoom, fit and rotation: before the change it records the block
 * under the reading point (the active Find match when one is on screen, otherwise the middle of
 * the view) and afterwards scrolls that same spot of that block back to the same height.
 */
export const useReadingAnchor = (
  body: RefObject<HTMLElement | null>,
  root: HTMLElement | null,
  activeMatch: () => Range | undefined,
  rotation: () => number,
) => {
  const anchor = useRef<Anchor | null>(null);
  const viewOf = () => {
    const frame = root && root.ownerDocument !== document ? root.ownerDocument : null;
    const scroller = scrollerOf(body.current, root);
    if (!scroller) return null;
    const box = frame
      ? { top: 0, left: 0, width: scroller.clientWidth, height: scroller.clientHeight }
      : scroller.getBoundingClientRect();
    return { owner: frame ?? document, scroller, box };
  };
  return {
    /** Records the reading point; `point` (a pinch or Ctrl+wheel position) takes precedence. */
    capture: (point?: { x: number; y: number }) => {
      const view = viewOf();
      if (!view) return;
      const { owner, scroller, box } = view;
      const mark = activeMatch()?.getBoundingClientRect();
      const visible = !!mark?.height && mark.top >= box.top && mark.bottom <= box.top + box.height;
      const x =
        point?.x ?? (visible ? mark.left + Math.min(mark.width / 2, 4) : box.left + box.width / 2);
      const y = point?.y ?? (visible ? mark.top + mark.height / 2 : box.top + box.height / 2);
      const hit = owner.elementFromPoint(x, y);
      const element = hit?.closest(blocks) ?? hit;
      if (!element || !scroller.contains(element)) return;
      const rect = element.getBoundingClientRect();
      anchor.current = {
        element,
        fraction: rect.height ? (y - rect.top) / rect.height : 0,
        across: rect.width ? (x - rect.left) / rect.width : 0,
        offset: y - box.top,
        offsetX: x - box.left,
        scroller,
        rotation: rotation(),
      };
    },
    restore: () => {
      const view = viewOf();
      const saved = anchor.current;
      if (!view || !saved?.element.isConnected || saved.scroller !== view.scroller) return;
      // The reader scrolled since the last restore: their position wins.
      if (saved.restored !== undefined && saved.scroller.scrollTop !== saved.restored) {
        anchor.current = null;
        return;
      }
      const rect = saved.element.getBoundingClientRect();
      // Turned content keeps the same point of the content, not the same spot of its box.
      const now = rotation();
      const spot =
        now !== saved.rotation && saved.element.matches(turning)
          ? turn(unturn({ across: saved.across, down: saved.fraction }, saved.rotation), now)
          : { across: saved.across, down: saved.fraction };
      const point = rect.top + spot.down * rect.height - view.box.top;
      const pointX = rect.left + spot.across * rect.width - view.box.left;
      saved.scroller.scrollTop += point - saved.offset;
      saved.scroller.scrollLeft += pointX - saved.offsetX;
      saved.restored = saved.scroller.scrollTop;
    },
    clear: () => {
      anchor.current = null;
    },
  };
};
