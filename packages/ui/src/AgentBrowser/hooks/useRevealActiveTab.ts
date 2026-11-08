import { useLayoutEffect, useRef } from 'react';

/**
 * A ref for the scrolling tab strip that keeps the selected tab wholly in view (never leaving a
 * sliver of its neighbour at the edge) whenever it, or the tab count, changes, and marks which
 * edges have more tabs beyond them so only those fade.
 */
export const useRevealActiveTab = (activeTab: string | undefined, count: number) => {
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
        // Past the neighbour's edge too: a partly hidden tab reads as a clipped title.
        if (selected.right > bounds.right) lane.scrollLeft += selected.right - bounds.right + 16;
        else if (selected.left < bounds.left) lane.scrollLeft -= bounds.left - selected.left + 16;
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
  }, [activeTab, count]);
  return strip;
};
