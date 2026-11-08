import { useEffect } from 'react';
import { setBrowserPresence } from '@/DesktopBrowserHost/presence.ts';

/**
 * Tells the rest of the app what the browser panel knows: that it sits beside the chat (so a tight
 * window can fold the sidebar) and which runs are paused because the user holds their pages (so
 * chat says "Paused · you have control"), across every agent's session here, not only the one
 * shown.
 */
export const useBrowserPanelPresence = (open: boolean, heldRuns: string[]) => {
  // Run ids never contain commas; a joined key keeps the effect stable across renders.
  const held = heldRuns.join(',');
  useEffect(() => {
    setBrowserPresence({ panelOpen: open });
    return () => setBrowserPresence({ panelOpen: false });
  }, [open]);
  useEffect(() => {
    setBrowserPresence({ heldRuns: held ? held.split(',') : [] });
    return () => setBrowserPresence({ heldRuns: [] });
  }, [held]);
};
