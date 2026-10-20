import { useEffect, useState } from 'react';
import type { BrowserControl } from '../types.ts';

export const useBrowserSize = (enabled: boolean, resize: BrowserControl['resize']) => {
  const [element, attach] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState('');
  useEffect(() => {
    if (!element) return;
    const measure = () =>
      setSize((previous) => {
        const next = { width: element.offsetWidth - 2, height: element.offsetHeight - 2 };
        return next.width === previous.width && next.height === previous.height ? previous : next;
      });
    const observer = new ResizeObserver(measure);
    observer.observe(element, { box: 'border-box' });
    return () => observer.disconnect();
  }, [element]);
  useEffect(() => {
    if (!enabled || !size.width || !size.height) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const viewport = {
      width: Math.max(240, Math.min(2560, size.width)),
      height: Math.max(160, Math.min(2160, size.height)),
    };
    const update = async () => {
      try {
        const result = await resize(viewport, controller.signal);
        if (!controller.signal.aborted) setError('');
        if (!result.applied && !controller.signal.aborted)
          timer = setTimeout(() => void update(), 1000);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'Could not resize the browser.');
      }
    };
    timer = setTimeout(() => void update(), 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, resize, size.width, size.height]);
  return { attach, size, error };
};
