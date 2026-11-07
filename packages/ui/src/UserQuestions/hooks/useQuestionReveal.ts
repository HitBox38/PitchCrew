import { useLayoutEffect } from 'react';
import { questionOwnsFocus } from '../focus.ts';

/** Opening a dock reveals its actions in a short column without changing keyboard focus. */
export const useQuestionReveal = (id: string | undefined) => {
  useLayoutEffect(() => {
    if (!id) return;
    const pathname = window.location.pathname;
    const answer = document.getElementById(`answer-${id}`);
    const form = answer?.closest('form') ?? null;
    const dock = answer?.closest<HTMLElement>('.pending-user-questions');
    const column = dock?.closest<HTMLElement>('.chat-panel');
    let openingUntil = performance.now() + 400;
    let readingChoices = false,
      pendingOpen = false,
      frame = 0;
    const schedule = (opening = false) => {
      pendingOpen ||= opening;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (window.location.pathname !== pathname) return;
          const opening = pendingOpen || performance.now() < openingUntil;
          pendingOpen = false;
          if (!opening && (readingChoices || !questionOwnsFocus(form))) return;
          if (!dock || !column || column.scrollHeight <= column.clientHeight + 1) return;
          const bottom = dock.getBoundingClientRect().bottom;
          const edge = column.getBoundingClientRect().bottom;
          if (bottom > edge) column.scrollTop += bottom - edge;
        });
      });
    };
    const input = () => {
      readingChoices = false;
      schedule();
    };
    const focus = (event: FocusEvent) => {
      readingChoices = event.target !== answer;
    };
    const reading = (event: Event) => {
      openingUntil = 0;
      pendingOpen = false;
      if (event.target instanceof Element && event.target.closest('.user-question-fields'))
        readingChoices = true;
    };
    const scrolling = () => {
      openingUntil = 0;
      pendingOpen = false;
      readingChoices = true;
    };
    const resize = new ResizeObserver(() => schedule());
    if (answer) resize.observe(answer);
    if (dock) resize.observe(dock);
    answer?.addEventListener('input', input);
    form?.addEventListener('focusin', focus);
    dock?.addEventListener('wheel', reading, { passive: true });
    dock?.addEventListener('keydown', reading);
    column?.addEventListener('wheel', scrolling, { passive: true });
    column?.addEventListener('touchmove', scrolling, { passive: true });
    schedule(true);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      answer?.removeEventListener('input', input);
      form?.removeEventListener('focusin', focus);
      dock?.removeEventListener('wheel', reading);
      dock?.removeEventListener('keydown', reading);
      column?.removeEventListener('wheel', scrolling);
      column?.removeEventListener('touchmove', scrolling);
    };
  }, [id]);
};
