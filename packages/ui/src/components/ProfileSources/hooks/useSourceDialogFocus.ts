import { useLayoutEffect, useRef } from 'react';
import type { ProfileSourcesModel } from '../types.ts';

export const useSourceDialogFocus = (c: ProfileSourcesModel, open: boolean) => {
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const previous = useRef<string | null>(null);
  const count = useRef(c.sources.length);
  const needsFocus = useRef(false);
  useLayoutEffect(() => {
    if (!open) {
      previous.current = null;
      return;
    }
    if (
      (previous.current !== null && previous.current !== c.screen) ||
      count.current > c.sources.length
    ) {
      needsFocus.current = true;
      if (panel.current) panel.current.scrollTop = 0;
    }
    previous.current = c.screen;
    count.current = c.sources.length;
    if (!needsFocus.current || c.busy) return;
    const target =
      c.screen === 'list'
        ? (panel.current?.querySelector<HTMLElement>(
            `[data-source-focus="${CSS.escape(c.returnFocus)}"]`,
          ) ?? panel.current?.querySelector<HTMLElement>('[data-source-focus="add"]'))
        : heading.current;
    (target ?? heading.current)?.focus({ preventScroll: true });
    if (c.screen === 'list') target?.scrollIntoView({ block: 'nearest' });
    needsFocus.current = false;
  }, [open, c.screen, c.busy, c.returnFocus, c.sources.length]);
  return { heading, panel };
};
