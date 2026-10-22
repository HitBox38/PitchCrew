import { useCallback, useState } from 'react';

/** Matches the `settings` container query in styles/settings.css (46rem). */
const compactWidth = 736;

/** Settings switches to top tabs from its own width, so tablets beside the sidebar get it too. */
export const useCompactSettings = () => {
  const [compact, setCompact] = useState(() => window.innerWidth < 768);
  const ref = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCompact(entry.contentRect.width < compactWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [compact, ref] as const;
};
