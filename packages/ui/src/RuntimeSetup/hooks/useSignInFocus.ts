import { useEffect, useRef } from 'react';

/** Wait until the replacement action is mounted and enabled before returning keyboard focus. */
export const useSignInFocus = (present: boolean, canRestore: boolean, id: string) => {
  const previous = useRef(present);
  const pending = useRef(false);
  useEffect(() => {
    if (previous.current && !present) pending.current = true;
    previous.current = present;
    if (!pending.current || !canRestore) return;
    const target = document.getElementById(id);
    if (!(target instanceof HTMLButtonElement) || target.disabled) return;
    target.focus();
    pending.current = false;
  }, [present, canRestore, id]);
};
