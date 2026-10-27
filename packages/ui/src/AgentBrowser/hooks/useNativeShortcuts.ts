import { useEffect } from 'react';
import type {
  NativeBrowserCommand,
  NativeBrowserState,
} from '../../../../core/src/native-browser.ts';

export const useNativeShortcuts = (
  id: string | undefined,
  leaseId: string | null,
  state: NativeBrowserState | null,
  command: (value: NativeBrowserCommand) => Promise<void>,
  setFindOpen: (open: boolean) => void,
  working: boolean,
) => {
  useEffect(() => {
    const bridge = window.pitchcrewBrowser;
    if (!id || !leaseId || !bridge) return;
    const inPanel = () => document.activeElement?.closest('#agent-browser-panel');
    const focus = () =>
      queueMicrotask(() => {
        void bridge.focusControls(id, !!inPanel()).catch(() => {});
      });
    const shortcut = (key: string, shift: boolean) => {
      const address = document.querySelector<HTMLInputElement>('[aria-label="Browser address"]');
      const focusAddress = () => {
        address?.focus();
        address?.select();
      };
      if (key === 'l') focusAddress();
      if (key === 'f') setFindOpen(true);
      if (working) return;
      if (key === 't') void command({ kind: 'new-tab' }).then(focusAddress);
      if (key === 'r') void command({ kind: shift ? 'hard-reload' : 'reload' });
      if (['+', '=', '-', '0'].includes(key)) {
        const zoom = state?.tabs.find((tab) => tab.id === state.activeTab)?.zoomFactor ?? 1;
        void command({
          kind: 'zoom',
          factor:
            key === '0' ? 1 : Math.max(0.25, Math.min(5, zoom + (key === '-' ? -0.25 : 0.25))),
        });
      }
      if (key === 'w' && state) void command({ kind: 'close-tab', tabId: state.activeTab });
      if (key === 'tab' && state?.tabs.length) {
        const index = state.tabs.findIndex((tab) => tab.id === state.activeTab);
        const next = (index + (shift ? -1 : 1) + state.tabs.length) % state.tabs.length;
        void command({ kind: 'select-tab', tabId: state.tabs[next].id });
      }
    };
    const keydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        !inPanel() ||
        event.altKey ||
        (!event.ctrlKey && !event.metaKey) ||
        !(
          ['l', 'f', 't', 'w', 'r', '+', '=', '-', '0'].includes(key) ||
          (event.ctrlKey && key === 'tab')
        )
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      shortcut(key, event.shiftKey);
    };
    const unsubscribe = bridge.subscribeShortcuts((event) => {
      if (event.id === id) shortcut(event.key, event.shift);
    });
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', focus);
    document.addEventListener('keydown', keydown, true);
    focus();
    return () => {
      unsubscribe();
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', focus);
      document.removeEventListener('keydown', keydown, true);
      void bridge.focusControls(id, false).catch(() => {});
    };
  }, [id, leaseId, state, command, setFindOpen, working]);
};
