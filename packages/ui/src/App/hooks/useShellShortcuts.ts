import { useEffect, useLayoutEffect, useRef } from 'react';
import type { View } from '@/navigation.ts';
import { primaryShortcutViews } from '@/AppSidebar/constants.ts';

/**
 * The backdrop every modal dialog and sheet renders while open (job details included). Base UI 1.8
 * sets `aria-modal` only on toasts, so the backdrop is how the shell tells a modal is open.
 */
const modalOpen = () =>
  !!document.querySelector('[data-slot="dialog-overlay"], [data-slot="sheet-overlay"]');

/**
 * Shell-level shortcuts: ⌘/Ctrl+1–4 open Home, Pipeline, Crew and Profile, and ⌘/Ctrl+\ hides
 * or shows the sidebar beside the existing ⌘/Ctrl+B. Navigation still runs through the router's
 * unsaved-change guards. While a modal dialog or sheet is open, ⌘/Ctrl+1–4 do nothing (and never
 * switch the browser's tabs): the page under it stays put until the user closes it.
 */
export const useShellShortcuts = (go: (view: View) => void, toggleSidebar: () => void) => {
  const ref = useRef({ go, toggleSidebar });
  useLayoutEffect(() => {
    ref.current = { go, toggleSidebar };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.repeat)
        return;
      if (event.key === '\\') {
        event.preventDefault();
        ref.current.toggleSidebar();
        return;
      }
      const view = primaryShortcutViews[Number(event.key) - 1];
      if (!view || !/^[1-4]$/.test(event.key)) return;
      event.preventDefault();
      if (!modalOpen()) ref.current.go(view);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
};
