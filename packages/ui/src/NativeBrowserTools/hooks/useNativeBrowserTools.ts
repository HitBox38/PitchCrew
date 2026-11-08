import { useLayoutEffect, useRef, useState } from 'react';
import type { NativeBrowserModel } from '@/AgentBrowser/hooks/useNativeBrowser.ts';
import type { BrowserControl } from '@/AgentBrowser/types.ts';
import type { DesktopBrowserCapture } from '../../../../core/src/native-browser.ts';
import { useBrowserRecording } from './useBrowserRecording.ts';
import { useElementPick } from './useElementPick.ts';

export const useNativeBrowserTools = (model: NativeBrowserModel, control: BrowserControl) => {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Page settings, which holds these tools; picking closes it so the whole page is clickable.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    owner: string;
    capture: DesktopBrowserCapture;
  } | null>(null);
  const tab = model.state?.tabs.find((item) => item.id === model.state?.activeTab);
  const owner = `${model.identity?.id}:${tab?.id}`;
  const current = useRef(owner);
  useLayoutEffect(() => {
    current.current = owner;
  }, [owner]);
  // A pick belongs to this panel and tab: switching tabs or unmounting ends it in the host.
  const element = useElementPick(model, control, owner, current, (capture) =>
    setSnapshot({ owner: current.current, capture }),
  );
  const recording = useBrowserRecording(model.identity!.id, tab?.id ?? '', control.leaseId);
  const capture = snapshot?.owner === owner ? snapshot.capture : null;
  // Capture works while the agent is idle; recording is bound to a held control lease.
  const disabled =
    !control.available || control.working || busy || element.picking || recording.busy;
  const screenshot = async () => {
    const bridge = window.pitchcrewBrowser;
    if (!bridge?.capture || !model.identity) return;
    const requested = owner;
    setBusy(true);
    setError('');
    try {
      // The desktop host captures only under control; idle browsing takes it here.
      if (!(await control.ensure())) return;
      const next = await bridge.capture(model.identity.id);
      if (current.current === requested) setSnapshot({ owner: requested, capture: next });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not capture the page.');
    } finally {
      setBusy(false);
    }
  };
  // Pick one element on the page (DevTools-style highlight), then review it like a screenshot.
  const pick = () => {
    setSettingsOpen(false);
    setError('');
    return element.pick();
  };
  const floating = async () => {
    try {
      if (!tab?.floating && !(await control.ensure())) return;
      await window.pitchcrewBrowser!.floating(model.identity!.id, !tab?.floating);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not open the separate browser window.',
      );
    }
  };
  return {
    error,
    capture,
    closeCapture: () => setSnapshot(null),
    tab,
    recording,
    disabled,
    recordable: !!control.leaseId,
    screenshot,
    pick,
    picking: element.picking,
    settingsOpen,
    setSettingsOpen,
    cancelPick: element.cancel,
    floating,
  };
};
