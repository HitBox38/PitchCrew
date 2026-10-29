import { useEffect, useRef, useState } from 'react';

/** Navigation updates the location bar without overwriting a human's focused draft. */
export const useBrowserAddress = (
  address: string,
  leaseId: string | undefined,
  contextId?: string,
) => {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(address);
  const [focused, setFocused] = useState(false);
  const previousContext = useRef(contextId);
  const previousLease = useRef(leaseId);
  useEffect(() => {
    if (previousContext.current !== contextId || previousLease.current !== leaseId)
      setDraft(address);
    if (previousLease.current !== leaseId) setFocused(false);
    previousContext.current = contextId;
    previousLease.current = leaseId;
  }, [address, leaseId, contextId]);
  return {
    input,
    draft,
    value: focused ? draft : address,
    setDraft,
    focus: () => {
      setDraft(address);
      setFocused(true);
      queueMicrotask(() => input.current?.select());
    },
    blur: () => setFocused(false),
    reset: () => {
      setDraft(address);
      input.current?.blur();
    },
  };
};
