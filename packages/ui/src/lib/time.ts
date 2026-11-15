import { useSyncExternalStore } from 'react';

export const timeAgo = (date: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  return mins < 1
    ? 'Just now'
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// One clock for every relative time, so each stays current without its message rendering again.
const listeners = new Set<() => void>();
let ticking: ReturnType<typeof setInterval> | undefined;
const subscribe = (change: () => void) => {
  listeners.add(change);
  ticking ??= setInterval(() => {
    for (const listener of listeners) listener();
  }, 30000);
  return () => {
    listeners.delete(change);
    if (listeners.size) return;
    clearInterval(ticking);
    ticking = undefined;
  };
};
const halfMinute = () => Math.floor(Date.now() / 30000);
/** Renders the caller again every half minute. */
export const useClock = () => useSyncExternalStore(subscribe, halfMinute);
