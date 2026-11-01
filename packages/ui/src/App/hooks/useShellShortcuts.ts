import { useEffect, useLayoutEffect, useRef } from 'react';
import type { View } from '@/navigation.ts';
import { primaryShortcutViews } from '@/AppSidebar/constants.ts';

/**
 * Shell-level shortcuts: ⌘/Ctrl+1–4 open Board, Decisions, Crew and Profile, and ⌘/Ctrl+\ hides
 * or shows the sidebar beside the existing ⌘/Ctrl+B. Navigation still runs through the router's
 * unsaved-change guards; modal dialogs keep their own keys.
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
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      ref.current.go(view);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
};
