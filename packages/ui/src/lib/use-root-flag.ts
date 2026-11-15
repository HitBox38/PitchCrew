import { useLayoutEffect } from 'react';

/**
 * Sets `data-<name>` on the document element while `on`, before paint. Page-wide styles key off
 * it instead of `:root:has(…)`, which made Chrome recheck the whole document after any change.
 */
export const useRootFlag = (name: string, on: boolean) =>
  useLayoutEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.setAttribute(`data-${name}`, '');
    return () => root.removeAttribute(`data-${name}`);
  }, [name, on]);
