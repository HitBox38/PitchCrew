import { useLayoutEffect, useRef } from 'react';

/**
 * A ref for the scrolling tab strip that keeps the selected tab in view whenever it, or the tab
 * count, changes, and when the strip resizes.
 */
export const useRevealActiveTab = (activeTab: string | undefined, count: number) => {
  const strip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const lane = strip.current;
    if (!lane) return;
    const reveal = () => {
      const tab = lane.querySelector<HTMLElement>('.browser-tab[data-active="true"]');
      if (!tab) return;
      const bounds = lane.getBoundingClientRect();
      const selected = tab.getBoundingClientRect();
      if (selected.right > bounds.right) lane.scrollLeft += selected.right - bounds.right;
      else if (selected.left < bounds.left) lane.scrollLeft -= bounds.left - selected.left;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(lane);
    return () => observer.disconnect();
  }, [activeTab, count]);
  return strip;
};
