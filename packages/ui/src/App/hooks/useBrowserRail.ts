import { useSyncExternalStore } from 'react';
import { useBrowserPresenceField } from '@/DesktopBrowserHost/presence.ts';
import type { View } from '@/navigation.ts';

// Sidebar (276) + chat (340) + a 32rem panel: below this the panel would be cramped.
const query = '(width < 72rem)';
const subscribe = (change: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};

/**
 * Between the sheet threshold (900px) and 1152px, an open browser panel needs the sidebar's width
 * to stay at least 32rem: the sidebar temporarily prefers its rail without changing the saved
 * preference.
 */
export const useBrowserRail = (view: View | undefined) => {
  const tight = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  // Only this field: the shell must not re-render on cursor or target updates.
  const panelOpen = useBrowserPresenceField('panelOpen');
  return view === 'chat' && panelOpen && tight;
};
