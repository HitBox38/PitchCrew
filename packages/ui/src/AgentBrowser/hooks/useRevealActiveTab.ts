import { useLayoutEffect, useRef } from 'react';
import { revealScroll } from '../helpers.ts';

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
        // In content coordinates: the tab's span, and the readable span for a scroll position
        // (excluding the fade on any edge that has tabs beyond it).
        const start =
          tab.getBoundingClientRect().left - lane.getBoundingClientRect().left + lane.scrollLeft;
        const next = revealScroll({
          start,
          end: start + tab.getBoundingClientRect().width,
          scroll: lane.scrollLeft,
          width: lane.clientWidth,
          content: lane.scrollWidth,
          fade,
        });
        if (next !== lane.scrollLeft) lane.scrollLeft = next;
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
