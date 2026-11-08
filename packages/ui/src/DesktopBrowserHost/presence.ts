import { useSyncExternalStore } from 'react';

/** Asks the panel that owns the current element pick to cancel it (the tray's Cancel). */
export const browserCancelPickEvent = 'pitchcrew:browser-cancel-pick';

/** The agent shown in the browser panel, for the page overlay's cursor and request ring. */
export interface BrowserPresence {
  name: string;
  /** An agent run is using the browser: the cursor rests visible instead of fading out. */
  working: boolean;
  /** The element a waiting request would act on, in page CSS pixels. */
  target: { x: number; y: number; width: number; height: number } | null;
  /** The native browser whose page the user is picking an element on. */
  picking: string | null;
  /** The browser panel is open beside the chat (not as a sheet). */
  panelOpen: boolean;
  /** Agent runs paused because the user holds their pages, so chat can say so. */
  heldRuns: string[];
}

let presence: BrowserPresence = {
  name: '',
  working: false,
  target: null,
  picking: null,
  panelOpen: false,
  heldRuns: [],
};
const listeners = new Set<() => void>();

const sameTarget = (a: BrowserPresence['target'], b: BrowserPresence['target']) =>
  a === b ||
  (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

export const setBrowserPresence = (next: Partial<BrowserPresence>) => {
  const merged = { ...presence, ...next };
  if (
    merged.name === presence.name &&
    merged.working === presence.working &&
    merged.picking === presence.picking &&
    merged.panelOpen === presence.panelOpen &&
    merged.heldRuns.join(',') === presence.heldRuns.join(',') &&
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

/** One field of the presence, so a subscriber re-renders only when that field changes. */
export const useBrowserPresenceField = <K extends keyof BrowserPresence>(key: K) =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => presence[key],
  );
