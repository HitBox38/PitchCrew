import { useLayoutEffect, useRef, useState } from 'react';
import type { NativeBrowserModel } from '@/AgentBrowser/hooks/useNativeBrowser.ts';
import type { BrowserControl } from '@/AgentBrowser/types.ts';
import type { DesktopBrowserCapture } from '../../../../core/src/native-browser.ts';
import { useBrowserRecording } from './useBrowserRecording.ts';

export const useNativeBrowserTools = (model: NativeBrowserModel, control: BrowserControl) => {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
  const recording = useBrowserRecording(model.identity!.id, tab?.id ?? '', control.leaseId);
  const capture = snapshot?.owner === owner ? snapshot.capture : null;
  const disabled = !control.leaseId || control.working || busy || recording.busy;
  const screenshot = async () => {
    const bridge = window.pitchcrewBrowser;
    if (!bridge?.capture || !model.identity) return;
    const requested = owner;
    setBusy(true);
    setError('');
    try {
      const next = await bridge.capture(model.identity.id);
      if (current.current === requested) setSnapshot({ owner: requested, capture: next });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not capture the page.');
    } finally {
      setBusy(false);
    }
  };
  const floating = async () => {
    try {
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
    screenshot,
    floating,
  };
};
