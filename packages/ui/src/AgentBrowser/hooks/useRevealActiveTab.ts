import { useLayoutEffect, useRef } from 'react';

/** The strip's fade width: a tab under it is not readable, so reveal clears it too. */
const fade = 16;

/**
 * A ref for the scrolling tab strip that keeps the selected tab wholly readable (clear of the edge
 * fades, never leaving a sliver of its neighbour) whenever it, the tab order or the strip's size
 * changes, and marks which edges have more tabs beyond them so only those fade.
 */
export const useRevealActiveTab = (activeTab: string | undefined, order: string) => {
  const strip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const lane = strip.current;
    if (!lane) return;
    const edges = () => {
      lane.toggleAttribute('data-overflow-start', lane.scrollLeft > 1);
      lane.toggleAttribute(
        'data-overflow-end',
        lane.scrollLeft + lane.clientWidth < lane.scrollWidth - 1,
      );
    };
    const reveal = () => {
      const tab = lane.querySelector<HTMLElement>('.browser-tab[data-active="true"]');
      if (tab) {
        const bounds = lane.getBoundingClientRect();
        const selected = tab.getBoundingClientRect();
        // The readable area excludes the fade on any edge that has tabs beyond it.
        const left = bounds.left + (lane.scrollLeft > 1 ? fade : 0);
        const right =
          bounds.right - (lane.scrollLeft + lane.clientWidth < lane.scrollWidth - 1 ? fade : 0);
        if (selected.right > right) lane.scrollLeft += selected.right - right + fade;
        else if (selected.left < left) lane.scrollLeft -= left - selected.left + fade;
      }
      edges();
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(lane);
    lane.addEventListener('scroll', edges, { passive: true });
    return () => {
      observer.disconnect();
      lane.removeEventListener('scroll', edges);
    };
  }, [activeTab, order]);
  return strip;
};
