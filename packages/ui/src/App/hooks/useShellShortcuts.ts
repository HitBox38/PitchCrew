import { useEffect, useLayoutEffect, useRef } from 'react';
import type { View } from '@/navigation.ts';
import { primaryShortcutViews } from '@/AppSidebar/constants.ts';

/**
 * Shell-level shortcuts: ⌘/Ctrl+1–4 open Home, Pipeline, Crew and Profile, and ⌘/Ctrl+\ hides
 * or shows the sidebar beside the existing ⌘/Ctrl+B. Navigation still runs through the router's
 * unsaved-change guards. The `aria-modal` check below never matches a Base UI 1.8 dialog (only its
 * toasts set the attribute), so ⌘/Ctrl+1–4 also navigate while a dialog or the job details sheet
 * is open; which dialogs should hold navigation is an open product decision.
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
