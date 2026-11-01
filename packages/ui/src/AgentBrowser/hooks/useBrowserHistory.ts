import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { NativeBrowserState } from '../../../../core/src/native-browser.ts';
import {
  browserClosedTabsLimit,
  readBrowserHistory,
  rememberBrowserPage,
  type BrowserHistoryEntry,
} from '../history.ts';

const stores = new Map<string, ReturnType<typeof createHistoryStore>>();
const createHistoryStore = (key: string, persistent: boolean) => {
  const storageKey = `pitchcrew:browser-history:v1:${key}`;
  let entries: BrowserHistoryEntry[] = [];
  const listeners = new Set<() => void>();
  if (persistent)
    try {
      entries = readBrowserHistory(localStorage.getItem(storageKey));
    } catch {
      /* Browsing remains available when device storage is unavailable. */
    }
  const replace = (next: BrowserHistoryEntry[]) => {
    if (JSON.stringify(next) === JSON.stringify(entries)) return;
    entries = next;
    if (persistent)
      try {
        localStorage.setItem(storageKey, JSON.stringify(entries));
      } catch {
        /* Keep this window's history when device storage is full. */
      }
    for (const listener of listeners) listener();
  };
  return {
    read: () => entries,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    remember: (page: { url: string; title: string }, limit?: number) =>
      replace(rememberBrowserPage(entries, page, Date.now(), limit)),
    clear: () => replace([]),
    forget: (url: string) => replace(entries.filter((entry) => entry.url !== url)),
  };
};
const getStore = (key: string, persistent: boolean) => {
  const existing = stores.get(key);
  if (existing) return existing;
  const store = createHistoryStore(key, persistent);
  stores.set(key, store);
  return store;
};

export const useBrowserHistory = (
  roleId: string,
  thread: string,
  state: NativeBrowserState | null,
  manual: boolean,
) => {
  const profile = state?.profile?.id ?? 'default';
  const workspace = state?.profile?.workspaceKey;
  const session = state?.id ?? thread;
  const visited = useMemo(
    () => getStore(`${workspace ? `${workspace}:` : ''}${roleId}:${profile}`, true),
    [workspace, roleId, profile],
  );
  const closed = useMemo(
    () => getStore(`closed:${roleId}:${session}:${profile}`, false),
    [roleId, session, profile],
  );
  const visits = useSyncExternalStore(visited.subscribe, visited.read);
  const closedTabs = useSyncExternalStore(closed.subscribe, closed.read);
  const current = state?.tabs.find((tab) => tab.id === state.activeTab);
  const url = current?.url;
  const title = current?.title;
  const ready = !!current && !current.loading && !current.error;
  useEffect(() => {
    if (manual && ready && url) visited.remember({ url, title: title ?? '' });
  }, [manual, ready, url, title, visited]);
  const previous = useRef<{ scope: string; tabs: NativeBrowserState['tabs'] } | null>(null);
  const scope = `${roleId}:${session}:${profile}`;
  useEffect(() => {
    if (!state) return;
    if (manual && previous.current?.scope === scope)
      for (const tab of previous.current.tabs)
        if (!state.tabs.some((next) => (next.logicalId ?? next.id) === (tab.logicalId ?? tab.id)))
          closed.remember(tab, browserClosedTabsLimit);
    previous.current = { scope, tabs: state.tabs };
  }, [state, manual, closed, scope]);
  return {
    visits,
    closedTabs,
    clearVisits: visited.clear,
    clearClosed: closed.clear,
    forgetClosed: closed.forget,
  };
};
