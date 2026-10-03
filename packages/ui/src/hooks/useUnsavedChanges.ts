import { useBlocker } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

export function useUnsavedChanges(dirty: boolean, onRouteDiscard?: () => void) {
  const allowed = useRef(false);
  useEffect(() => {
    if (!dirty) allowed.current = false;
  }, [dirty]);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !allowed.current,
    enableBeforeUnload: dirty,
    disabled: !dirty,
    withResolver: true,
  });
  const requestLeave = (action: () => void) => {
    if (dirty) setPending(() => action);
    else action();
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
}
