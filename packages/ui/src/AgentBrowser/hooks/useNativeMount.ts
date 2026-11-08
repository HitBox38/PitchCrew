import { useCallback, useEffect, useState } from 'react';
import { claimSurface } from '../surface-leases.ts';

/** Measures the page slot and presents the native guest there while this slot owns it. */
export const useNativeMount = (id: string, enabled = true) => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  // React 19 ref cleanup: only the element that is detaching may clear the slot.
  const attach = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    setElement(node);
    return () => setElement((current) => (current === node ? null : current));
  }, []);
  useEffect(() => {
    const bridge = window.pitchcrewBrowser;
    if (!bridge || !element || !enabled) return;
    let animation = 0;
    let disposed = false;
    let previous = '';
    const sync = () => {
      animation = 0;
      if (disposed || !lease.owns()) return;
      const rect = element.getBoundingClientRect();
      const left = Math.max(0, rect.left + element.clientLeft);
      const top = Math.max(0, rect.top + element.clientTop);
      const bounds =
        document.hidden || !rect.width || !rect.height
          ? null
          : {
              x: Math.round(left),
              y: Math.round(top),
              width: Math.max(1, Math.round(Math.min(element.clientWidth, innerWidth - left))),
              height: Math.max(1, Math.round(Math.min(element.clientHeight, innerHeight - top))),
            };
      const next = JSON.stringify(bounds);
      if (next === previous) return;
      previous = next;
      void bridge.mount(id, bounds).catch(() => {});
    };
    const schedule = () => {
      if (!animation) animation = requestAnimationFrame(sync);
    };
    const lease = claimSurface(
      id,
      () => {
        // Regaining the page after a newer slot left: present again even if unchanged here.
        previous = '';
        schedule();
      },
      () => void bridge.mount(id, null).catch(() => {}),
    );
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    // Present in the same frame as the claim so a handoff never parks the page in between.
    sync();
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      resize.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      lease.release();
    };
  }, [id, element, enabled]);
  return attach;
};
