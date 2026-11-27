import { useLayoutEffect, useState } from 'react';
import { foldRem } from '../constants.ts';

/**
 * Whether the lens itself (not the window) is narrower than `foldRem`, measured before paint and
 * on every resize, so its rows fold where its container queries do. Returns a callback ref for the
 * lens element.
 */
export const useLensNarrow = () => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    if (!element) return;
    const measure = (width: number) => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setNarrow(width < foldRem * rem);
    };
    measure(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { ref: setElement, narrow };
};
