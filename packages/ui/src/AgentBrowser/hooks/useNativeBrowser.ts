import { useCallback, useEffect, useState } from 'react';
import type {
  NativeBrowserIdentity,
  NativeBrowserState,
  NativeBrowserCommand,
  DesktopBrowserBridge,
} from '../../../../core/src/native-browser.ts';
import type { BrowserControl } from '../types.ts';
import { browserCommand, browserPath } from '../api.ts';
import { api } from '@/api.ts';
import { useNativeShortcuts } from './useNativeShortcuts.ts';

declare global {
  interface Window {
    pitchcrewBrowser?: DesktopBrowserBridge;
  }
}
export const useNativeBrowser = (
  roleId: string,
  thread: string,
  identity: NativeBrowserIdentity | undefined,
  enabled: boolean,
  control: BrowserControl,
) => {
  const [owner, setOwner] = useState('');
  const [state, setState] = useState<NativeBrowserState | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  useEffect(() => {
    let disposed = false;
    void window.pitchcrewBrowser
      ?.identify()
      .then((id) => {
        if (!disposed) setOwner(id);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);
  const active = !!identity && identity.ownerId === owner;
  const nativeId = identity?.id;
  const { command: runCommand, leaseId } = control;
  useEffect(() => {
    if (!active || !enabled || !nativeId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const next = await api<NativeBrowserState>(
          browserPath(roleId, thread, 'native'),
          'GET',
          undefined,
          controller.signal,
        );
        if (!controller.signal.aborted) setState(next);
      } catch {
        /* A stopped session is refreshed by the session poller. */
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void read(), 400);
      }
    };
    void read();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, enabled, nativeId, roleId, thread]);
  const command = useCallback(
    (value: NativeBrowserCommand) =>
      runCommand(async () => {
        if (!leaseId) return;
        setState(await browserCommand(roleId, thread, 'native', { leaseId, command: value }));
      }),
    [leaseId, runCommand, roleId, thread],
  );
  useNativeShortcuts(
    active && enabled ? nativeId : undefined,
    leaseId,
    state,
    command,
    setFindOpen,
    control.working,
  );
  return {
    active,
    pending: !!window.pitchcrewBrowser && !!identity && !owner,
    identity,
    state: state?.id === identity?.id ? state : null,
    findOpen,
    setFindOpen,
    command,
  };
};
export type NativeBrowserModel = ReturnType<typeof useNativeBrowser>;
