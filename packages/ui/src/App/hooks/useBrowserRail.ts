import { useSyncExternalStore } from 'react';
import { useBrowserPresence } from '@/DesktopBrowserHost/presence.ts';
import type { View } from '@/navigation.ts';

const query = '(width < 61.25rem)';
const subscribe = (change: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};

/**
 * Between the sheet threshold (900px) and 980px, an open browser panel needs the sidebar's width:
 * the sidebar temporarily prefers its rail without changing the saved preference.
 */
export const useBrowserRail = (view: View | undefined) => {
  const tight = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  const { panelOpen } = useBrowserPresence();
  return view === 'chat' && panelOpen && tight;
};
