/** Reveal the reading text inside its own bounded queue, without moving the chat or focus. */
export const revealQueuedText = (reading: HTMLElement) => {
  const viewport = reading.closest<HTMLElement>('.chat-queue-content');
  const text = reading.querySelector<HTMLElement>('.chat-queued-full-text');
  if (!viewport || !text || !viewport.clientHeight) return;
  viewport.scrollTop = Math.max(
    0,
    viewport.scrollTop +
      text.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top -
      8,
  );
};

/** Opening height motion can initially clamp scrollTop. Follow only that bounded transition. */
export const beginQueuedTextReveal = (reading: HTMLElement) => {
  const viewport = reading.closest<HTMLElement>('.chat-queue-content');
  const panel = reading.querySelector<HTMLElement>('[data-slot="collapsible-content"]');
  if (!viewport || !panel) return;
  let stopped = false;
  const reveal = () => {
    if (!stopped && reading.isConnected) revealQueuedText(reading);
  };
  const observer = new ResizeObserver(reveal);
  const intent = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  const cleanup = () => {
    stopped = true;
    observer.disconnect();
    cancelAnimationFrame(frame);
    clearTimeout(deadline);
    panel.removeEventListener('transitionend', finish);
    for (const name of intent) viewport.removeEventListener(name, cleanup, true);
  };
  const finish = (event?: TransitionEvent) => {
    if (event && (event.target !== panel || event.propertyName !== 'height')) return;
    reveal();
    cleanup();
  };
  observer.observe(panel);
  observer.observe(viewport);
  for (const name of intent)
    viewport.addEventListener(name, cleanup, { capture: true, passive: true });
  panel.addEventListener('transitionend', finish);
  const duration = Math.max(
    ...getComputedStyle(panel)
      .transitionDuration.split(',')
      .map((value) => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000)),
  );
  const frame = requestAnimationFrame(reveal);
  const deadline = window.setTimeout(() => finish(), Math.min(500, (duration || 0) + 80));
  return cleanup;
};
