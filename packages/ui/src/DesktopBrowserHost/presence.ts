import { useSyncExternalStore } from 'react';

/** The agent shown in the browser panel, for the page overlay's cursor name tag and resting. */
export interface BrowserPresence {
  name: string;
  /** An agent run is using the browser: the cursor rests visible instead of fading out. */
  working: boolean;
}

let presence: BrowserPresence = { name: '', working: false };
const listeners = new Set<() => void>();

export const setBrowserPresence = (next: BrowserPresence) => {
  if (next.name === presence.name && next.working === presence.working) return;
  presence = next;
  for (const listener of listeners) listener();
};

export const useBrowserPresence = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => presence,
  );
