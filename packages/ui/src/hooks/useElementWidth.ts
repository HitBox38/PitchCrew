import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/** Reports an element's width now and whenever it resizes (window, side panels or a drag). */
export const useElementWidth = (
  element: RefObject<HTMLElement | null>,
  onWidth: (width: number) => void,
) => {
  const latest = useRef(onWidth);
  useLayoutEffect(() => {
    latest.current = onWidth;
  });
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    latest.current(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) latest.current(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);
};
