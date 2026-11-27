import type { KeyboardEvent } from 'react';

/** Up and Down move between one agent's entries and wrap; Tab still reaches each queue menu. */
export const moveBetweenEntries = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const list = event.currentTarget.closest('.crew-lens-entries');
  const stops = [...(list?.querySelectorAll<HTMLElement>('[data-lens-stop]') ?? [])].filter(
    (stop) => stop.getClientRects().length > 0,
  );
  const index = stops.indexOf(event.currentTarget);
  if (index < 0 || stops.length < 2) return;
  event.preventDefault();
  const step = event.key === 'ArrowDown' ? 1 : -1;
  stops[(index + step + stops.length) % stops.length]?.focus();
};
