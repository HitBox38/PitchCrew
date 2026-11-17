/**
 * Scrolls `scroller` for the keys a focused scroll region handles itself. The Word preview and a
 * zoomed image scroll inside their own element, so the focused document region forwards keys.
 */
export const scrollByKey = (
  scroller: Element,
  event: { key: string; shiftKey: boolean; preventDefault: () => void },
) => {
  const page = scroller.clientHeight * 0.9;
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    scroller.scrollTo({ top: event.key === 'Home' ? 0 : scroller.scrollHeight });
    return;
  }
  const steps: Record<string, number> = {
    ArrowDown: 40,
    ArrowUp: -40,
    PageDown: page,
    PageUp: -page,
    ' ': event.shiftKey ? -page : page,
  };
  const across: Record<string, number> = { ArrowRight: 40, ArrowLeft: -40 };
  if (across[event.key] !== undefined) {
    event.preventDefault();
    scroller.scrollBy({ left: across[event.key] });
    return;
  }
  const step = steps[event.key];
  if (step === undefined) return;
  event.preventDefault();
  scroller.scrollBy({ top: step });
};
