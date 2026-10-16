import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { CommandPalette } from '../constants.ts';

/** Resolve the palette before mounting its lazy component, avoiding the first-open fallback delay. */
export function usePaletteReady(open: boolean, onOpenChange: (open: boolean) => void) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open || ready) return;
    let active = true;
    void import('@/CommandPalette/index.tsx')
      .then(async () => {
        await CommandPalette.preload?.();
        if (active) setReady(true);
      })
      .catch(() => {
        if (!active) return;
        onOpenChange(false);
        useWorkspaceStore
          .getState()
          .setToast('Could not open command search. Reload the app and try again.', 'error');
      });
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', escape);
    return () => {
      active = false;
      window.removeEventListener('keydown', escape);
    };
  }, [open, ready, onOpenChange]);
  return ready;
}
