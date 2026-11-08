import { useEffect, useRef, useState, type RefObject } from 'react';
import type { NativeBrowserModel } from '@/AgentBrowser/hooks/useNativeBrowser.ts';
import type { BrowserControl } from '@/AgentBrowser/types.ts';
import type { DesktopBrowserCapture } from '../../../../core/src/native-browser.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { setBrowserPresence } from '@/DesktopBrowserHost/presence.ts';

/**
 * Element picking as one operation at a time. Cancel, a tab change and unmount end the current
 * operation at once (and in the host); every await rechecks that the operation still owns the
 * pick, so a cancelled pick never starts late, and only the owner may publish or clear the
 * shared "Picking" state.
 */
export const useElementPick = (
  model: NativeBrowserModel,
  control: BrowserControl,
  owner: string,
  current: RefObject<string>,
  picked: (capture: DesktopBrowserCapture) => void,
) => {
  const [picking, setPicking] = useState(false);
  const serial = useRef(0);
  const active = useRef(0);
  const hostId = useRef<string | null>(null);
  const cancel = () => {
    const id = hostId.current;
    const wasActive = active.current !== 0;
    active.current = 0;
    hostId.current = null;
    if (!wasActive) return;
    setBrowserPresence({ picking: null });
    setPicking(false);
    if (id) void window.pitchcrewBrowser?.cancelPick?.(id).catch(() => {});
  };
  const latestCancel = useRef(cancel);
  useEffect(() => {
    latestCancel.current = cancel;
  });
  useEffect(() => () => latestCancel.current(), [owner]);
  const pick = async () => {
    const bridge = window.pitchcrewBrowser;
    const id = model.identity?.id;
    if (!bridge?.pickElement || !id) return;
    const mine = ++serial.current;
    active.current = mine;
    const still = () => active.current === mine;
    const requested = owner;
    setPicking(true);
    try {
      if (!(await control.ensure()) || !still()) return;
      // The tray and chip say "Picking" with a Cancel; the page takes the click.
      setBrowserPresence({ picking: id });
      await bridge.focusPage(id).catch(() => {});
      if (!still()) return;
      hostId.current = id;
      const next = await bridge.pickElement(id);
      if (next && still() && current.current === requested) picked(next);
    } catch (cause) {
      // Page settings is closed while picking, so the outcome is a toast rather than its error row.
      if (still())
        useWorkspaceStore
          .getState()
          .setToast(cause instanceof Error ? cause.message : 'Could not pick an element.');
    } finally {
      if (still()) {
        active.current = 0;
        hostId.current = null;
        setBrowserPresence({ picking: null });
        setPicking(false);
      }
    }
  };
  return { picking, pick, cancel };
};
