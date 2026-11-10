import { useLayoutEffect, useRef } from 'react';
import { linkTaskBoxes } from '../task-boxes.ts';

/**
 * Links every rendered task box to its source task in one pass per render, and again if the
 * renderer adds boxes later, never box by box.
 */
export const useTaskBoxes = (content: string, source: string, editable: boolean) => {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    let frame = 0;
    const link = () => linkTaskBoxes(element, source, editable);
    link();
    const observer = new MutationObserver(() => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        link();
      });
    });
    observer.observe(element, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [content, source, editable]);
  return host;
};
