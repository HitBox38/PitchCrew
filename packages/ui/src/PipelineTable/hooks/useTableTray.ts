import { useCallback, useEffect, useRef } from 'react';
import { useScrollEdges } from '@/hooks/useScrollEdges.ts';

/**
 * Brings the row holding focus back into view (clear of the sticky header, by the tray's scroll
 * padding). The tray ends at its last row and shrinks when the selection bar docks under it or a
 * result appears above it, so the row just selected at its foot would otherwise slip out of view
 * with its focus ring.
 */
const keepFocusedRow = (tray: HTMLElement) => {
  const active = document.activeElement;
  if (!active || !tray.contains(active)) return;
  active.closest('[data-table-row]')?.scrollIntoView({ block: 'nearest' });
};

/**
 * The table's tray: one ref for its scroller and its shaded edges, and the scrolling and focus the
 * table's own controls ask of it. A new page starts at its first row, not where the last page was
 * scrolled to; dismissing a result hands focus back to the first row; a resize keeps the focused
 * row in view.
 */
export const useTableTray = (setPage: (page: number) => void, dismissResult: () => void) => {
  const scroller = useRef<HTMLDivElement | null>(null);
  const edges = useScrollEdges<HTMLDivElement>();
  const edgeRef = edges.ref;
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      scroller.current = node;
      edgeRef(node);
    },
    [edgeRef],
  );
  useEffect(() => {
    const tray = scroller.current;
    if (!tray) return;
    // Runs after layout and before paint, so the row never shows hidden for a frame.
    const observer = new ResizeObserver(() => keepFocusedRow(tray));
    observer.observe(tray);
    return () => observer.disconnect();
  }, []);
  return {
    scroller,
    ref,
    above: edges.above,
    below: edges.below,
    go: (page: number) => {
      setPage(page);
      requestAnimationFrame(() => scroller.current?.scrollTo({ top: 0 }));
    },
    dismiss: () => {
      dismissResult();
      requestAnimationFrame(() =>
        scroller.current
          ?.querySelector<HTMLElement>('[data-table-open]')
          ?.focus({ preventScroll: true }),
      );
    },
  };
};
