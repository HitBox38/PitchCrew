import { useEffect } from 'react';
import { setBrowserPresence } from '@/DesktopBrowserHost/presence.ts';

/**
 * Tells the rest of the app what the browser panel knows: that it sits beside the chat (so a tight
 * window can fold the sidebar) and which run is paused because the user holds its page (so chat
 * says "Paused · you have control" instead of "Working").
 */
export const useBrowserPanelPresence = (open: boolean, heldRun: string | null) => {
  useEffect(() => {
    setBrowserPresence({ panelOpen: open });
    return () => setBrowserPresence({ panelOpen: false });
  }, [open]);
  useEffect(() => {
    setBrowserPresence({ heldRun });
    return () => setBrowserPresence({ heldRun: null });
  }, [heldRun]);
};
