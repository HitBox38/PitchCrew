import { useEffect } from 'react';
import { setBrowserPresence } from '@/DesktopBrowserHost/presence.ts';

/** Tells the workspace the browser sits beside the chat, so a tight window can fold the sidebar. */
export const useBrowserPanelPresence = (open: boolean) => {
  useEffect(() => {
    setBrowserPresence({ panelOpen: open });
    return () => setBrowserPresence({ panelOpen: false });
  }, [open]);
};
