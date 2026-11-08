import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NativeBrowserModel } from '@/AgentBrowser/hooks/useNativeBrowser.ts';
import type { BrowserControl } from '@/AgentBrowser/types.ts';
import type { DesktopBrowserCapture } from '../../../../core/src/native-browser.ts';
import { useBrowserRecording } from './useBrowserRecording.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const useNativeBrowserTools = (model: NativeBrowserModel, control: BrowserControl) => {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
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
  // A pick belongs to this panel and tab: switching tabs or unmounting ends it in the host,
  // so inspect mode never outlives the review that would receive it.
  const pickingFor = useRef<string | null>(null);
  useEffect(
    () => () => {
      const id = pickingFor.current;
      pickingFor.current = null;
      if (id) void window.pitchcrewBrowser?.cancelPick?.(id).catch(() => {});
    },
    [owner],
  );
  const recording = useBrowserRecording(model.identity!.id, tab?.id ?? '', control.leaseId);
  const capture = snapshot?.owner === owner ? snapshot.capture : null;
  // Capture works while the agent is idle; recording is bound to a held control lease.
  const disabled = !control.available || control.working || busy || recording.busy;
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
  const pick = async () => {
    const bridge = window.pitchcrewBrowser;
    if (!bridge?.pickElement || !model.identity) return;
    const requested = owner;
    setSettingsOpen(false);
    setBusy(true);
    setPicking(true);
    setError('');
    try {
      if (!(await control.ensure())) return;
      useWorkspaceStore
        .getState()
        .setToast('Click an element on the page to attach it. Press Escape to cancel.');
      await bridge.focusPage(model.identity.id).catch(() => {});
      pickingFor.current = model.identity.id;
      const next = await bridge.pickElement(model.identity.id);
      if (next && current.current === requested) setSnapshot({ owner: requested, capture: next });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not pick an element.');
    } finally {
      pickingFor.current = null;
      setBusy(false);
      setPicking(false);
    }
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
    picking,
    settingsOpen,
    setSettingsOpen,
    cancelPick: () => void window.pitchcrewBrowser?.cancelPick?.(model.identity!.id),
    floating,
  };
};
