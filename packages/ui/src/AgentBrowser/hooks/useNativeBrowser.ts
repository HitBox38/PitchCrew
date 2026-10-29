import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  NativeBrowserIdentity,
  NativeBrowserState,
  NativeBrowserCommand,
  DesktopBrowserBridge,
} from '../../../../core/src/native-browser.ts';
import type { BrowserControl } from '../types.ts';
import { browserCommand, browserInput, browserPath } from '../api.ts';
import { api } from '@/api.ts';
import { useNativeShortcuts } from './useNativeShortcuts.ts';
import { useBrowserHistory } from './useBrowserHistory.ts';

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
  const eventRevision = useRef(0);
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
  const current = state?.id === nativeId ? state : null;
  const history = useBrowserHistory(roleId, thread, current, !!leaseId);
  useEffect(() => {
    if (!active || !enabled || !nativeId) return;
    return window.pitchcrewBrowser?.subscribeState?.((next) => {
      if (next.id !== nativeId || next.ownerId !== owner) return;
      eventRevision.current++;
      setState((previous) => ({
        ...next,
        ...(previous?.id === nativeId
          ? { dialog: previous.dialog, warning: previous.warning }
          : {}),
      }));
    });
  }, [active, enabled, nativeId, owner]);
  useEffect(() => {
    if (!active || !enabled || !nativeId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const revision = eventRevision.current;
        const next = await api<NativeBrowserState>(
          browserPath(roleId, thread, 'native'),
          'GET',
          undefined,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          const current = revision === eventRevision.current;
          setState((previous) =>
            current || previous?.id !== next.id
              ? next
              : {
                  ...previous,
                  dialog: next.dialog,
                  warning: next.warning,
                },
          );
        }
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
  const navigate = useCallback(
    async (url: string, newTab = false) => {
      let succeeded = false;
      await runCommand(async () => {
        if (!leaseId) return;
        if (newTab)
          setState(
            await browserCommand(roleId, thread, 'native', {
              leaseId,
              command: { kind: 'new-tab' },
            }),
          );
        await browserInput(roleId, thread, leaseId, { kind: 'navigate', url });
        succeeded = true;
        void window.pitchcrewBrowser?.focusPage(nativeId!).catch(() => {});
      });
      return succeeded;
    },
    [leaseId, runCommand, roleId, thread, nativeId],
  );
  const { closedTabs, forgetClosed } = history;
  const restoreClosed = useCallback(async () => {
    const tab = closedTabs[0];
    if (tab && (await navigate(tab.url, true))) forgetClosed(tab.url);
  }, [closedTabs, forgetClosed, navigate]);
  useNativeShortcuts(
    active && enabled ? nativeId : undefined,
    leaseId,
    state,
    command,
    setFindOpen,
    control.working,
    restoreClosed,
  );
  return {
    active,
    pending: !!window.pitchcrewBrowser && !!identity && !owner,
    identity,
    state: current,
    findOpen,
    setFindOpen,
    command,
    navigate,
    history,
  };
};
export type NativeBrowserModel = ReturnType<typeof useNativeBrowser>;
