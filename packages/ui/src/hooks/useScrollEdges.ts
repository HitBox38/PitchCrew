import { useEffect, useState } from 'react';

type Display = (element: Element) => string;

/**
 * The boxes whose size decides a scroller's height: its children, or, for a child that gives up
 * its box (`display: contents`, as Home's wide sections do), that child's own boxes. A box-less
 * child never reports a resize, so its content is watched instead.
 */
export const scrollBoxes = (
  element: Element,
  display: Display = (child) => getComputedStyle(child).display,
): Element[] =>
  [...element.children].flatMap((child) =>
    display(child) === 'contents' ? scrollBoxes(child, display) : [child],
  );

/**
 * Whether a scroller has more content above or below its view. Callers set `data-more-above` and
 * `data-more-below` (the names the chat queue and question choices already use) and draw shaded
 * edges from them, never a mask over text. The ref is a callback, so a scroller that mounts later
 * is measured too; it remeasures on scroll, whenever the scroller or one of its boxes resizes, and
 * whenever content is added or removed anywhere inside it.
 */
export const useScrollEdges = <T extends HTMLElement>() => {
  const [element, setElement] = useState<T | null>(null);
  const [edges, setEdges] = useState({ above: false, below: false });
  useEffect(() => {
    if (!element) return;
    const measure = () => {
      const above = element.scrollTop > 1;
      const below = element.scrollHeight > element.clientHeight + element.scrollTop + 1;
      setEdges((current) =>
        current.above === above && current.below === below ? current : { above, below },
      );
    };
    const sizes = new ResizeObserver(measure);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(element);
      for (const box of scrollBoxes(element)) sizes.observe(box);
    };
    let frame = 0;
    const content = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        watch();
        measure();
      });
    });
    watch();
    content.observe(element, { childList: true, subtree: true });
    element.addEventListener('scroll', measure, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      content.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, [element]);
  const ref: (node: T | null) => void = setElement;
  return { ref, ...edges };
};
