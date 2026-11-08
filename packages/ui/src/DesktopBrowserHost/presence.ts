import { useSyncExternalStore } from 'react';

/** The agent shown in the browser panel, for the page overlay's cursor and request ring. */
export interface BrowserPresence {
  name: string;
  /** An agent run is using the browser: the cursor rests visible instead of fading out. */
  working: boolean;
  /** The element a waiting request would act on, in page CSS pixels. */
  target: { x: number; y: number; width: number; height: number } | null;
}

let presence: BrowserPresence = { name: '', working: false, target: null };
const listeners = new Set<() => void>();

const sameTarget = (a: BrowserPresence['target'], b: BrowserPresence['target']) =>
  a === b ||
  (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

export const setBrowserPresence = (next: Partial<BrowserPresence>) => {
  const merged = { ...presence, ...next };
  if (
    merged.name === presence.name &&
    merged.working === presence.working &&
    sameTarget(merged.target, presence.target)
  )
    return;
  presence = merged;
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
