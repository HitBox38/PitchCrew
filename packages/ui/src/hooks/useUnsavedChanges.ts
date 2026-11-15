import { useBlocker } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

/**
 * Asks before leaving with unsaved changes. An optional `flush` (an editor that can save on its
 * own) is tried first; only drafts it could not save ask the user.
 */
export const useUnsavedChanges = (
  dirty: boolean,
  onRouteDiscard?: () => void,
  flush?: () => Promise<boolean>,
) => {
  const allowed = useRef(false);
  useEffect(() => {
    if (!dirty) allowed.current = false;
  }, [dirty]);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const blocker = useBlocker({
    shouldBlockFn: async () => {
      if (!dirty || allowed.current) return false;
      if (flush && (await flush())) return false;
      return true;
    },
    enableBeforeUnload: dirty,
    disabled: !dirty,
    withResolver: true,
  });
  const requestLeave = (action: () => void) => {
    if (!dirty) return action();
    if (!flush) return setPending(() => action);
    void flush().then((saved) => (saved ? action() : setPending(() => action)));
  };
  const keepEditing = () => {
    setPending(null);
    if (blocker.status === 'blocked') blocker.reset();
  };
  const discard = () => {
    setPending(null);
    if (pending) {
      allowed.current = true;
      pending();
    } else if (blocker.status === 'blocked') {
      onRouteDiscard?.();
      blocker.proceed();
    }
  };
  return {
    open: Boolean(pending) || blocker.status === 'blocked',
    requestLeave,
    keepEditing,
    discard,
  };
};
