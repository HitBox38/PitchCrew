import { useMemo, useSyncExternalStore } from 'react';
import { fillBrowserViewport, type BrowserViewportSetting } from './viewport.ts';

// Browser chrome unmounts on route changes; the native guest and its viewport do not.
const stores = new Map<string, ReturnType<typeof createDeviceStore>>();
const createDeviceStore = () => {
  let state = { open: false, setting: fillBrowserViewport };
  const listeners = new Set<() => void>();
  const update = (next: typeof state) => {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    read: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setSetting: (setting: BrowserViewportSetting) => update({ ...state, setting }),
    setOpen: (open: boolean) => update({ ...state, open }),
  };
};
export const useBrowserDevice = (id: string) => {
  const store = useMemo(() => {
    const existing = stores.get(id);
    if (existing) return existing;
    const next = createDeviceStore();
    stores.set(id, next);
    return next;
  }, [id]);
  const state = useSyncExternalStore(store.subscribe, store.read);
  return { ...state, setOpen: store.setOpen, setSetting: store.setSetting };
};
