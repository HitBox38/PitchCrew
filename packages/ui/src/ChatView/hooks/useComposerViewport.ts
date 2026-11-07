import { useEffect, type RefObject } from 'react';

/** A new dispatch row must not leave Send below the fold while the user is editing. */
export const useComposerViewport = (reference: RefObject<HTMLElement | null>, thread: string) => {
  useEffect(() => {
    const composer = reference.current;
    const panel = composer?.closest<HTMLElement>('.chat-panel');
    if (!composer || !panel) return;
    let frame = 0,
      pressing = false,
      permitted = true;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (
          !permitted ||
          pressing ||
          !composer.contains(document.activeElement) ||
          composer.hidden ||
          !composer.isConnected
        )
          return;
        const overflow =
          composer.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom;
        if (overflow > 0) panel.scrollTop += overflow + 4;
      });
    };
    const observer = new ResizeObserver(reveal);
    const observe = () => {
      observer.disconnect();
      for (const element of panel.children) observer.observe(element);
      reveal();
    };
    const mutation = new MutationObserver(observe);
    mutation.observe(panel, { childList: true });
    observe();
    const editing = () => {
      permitted = true;
      reveal();
    };
    const reading = () => {
      permitted = false;
    };
    const down = () => {
      pressing = true;
    };
    const up = () => {
      if (pressing) {
        pressing = false;
        reveal();
      }
    };
    composer.addEventListener('focusin', editing);
    composer.addEventListener('input', editing);
    composer.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    panel.addEventListener('wheel', reading, { passive: true });
    panel.addEventListener('touchmove', reading, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutation.disconnect();
      composer.removeEventListener('focusin', editing);
      composer.removeEventListener('input', editing);
      composer.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      panel.removeEventListener('wheel', reading);
      panel.removeEventListener('touchmove', reading);
    };
  }, [reference, thread]);
};
