import { useEffect, useState } from 'react';

export const useNativeMount = (id: string, enabled = true) => {
  const [element, attach] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const bridge = window.pitchcrewBrowser;
    if (!bridge || !element || !enabled) return;
    let animation = 0;
    let disposed = false;
    let previous = '';
    const sync = () => {
      animation = 0;
      const rect = element.getBoundingClientRect();
      const covered = [
        ...document.querySelectorAll(
          '[data-slot="dialog-content"],[data-slot="sheet-content"],[data-slot="popover-content"],[data-slot="dropdown-menu-content"],[data-slot="context-menu-content"]',
        ),
      ].some((surface) => !surface.contains(element) && surface.getClientRects().length);
      const left = Math.max(0, rect.left + element.clientLeft);
      const top = Math.max(0, rect.top + element.clientTop);
      const bounds =
        document.hidden || covered || !rect.width || !rect.height
          ? null
          : {
              x: Math.round(left),
              y: Math.round(top),
              width: Math.max(1, Math.round(Math.min(element.clientWidth, innerWidth - left))),
              height: Math.max(1, Math.round(Math.min(element.clientHeight, innerHeight - top))),
            };
      const next = JSON.stringify(bounds);
      if (disposed || next === previous) return;
      previous = next;
      void bridge.mount(id, bounds).catch(() => {});
    };
    const schedule = () => {
      if (!animation) animation = requestAnimationFrame(sync);
    };
    const resize = new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    resize.observe(element);
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-open', 'data-closed', 'aria-hidden', 'style'],
    });
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      resize.disconnect();
      mutations.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      void bridge.mount(id, null).catch(() => {});
    };
  }, [id, element, enabled]);
  return attach;
};
