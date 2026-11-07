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
  const edited = useRef(false);
  const previousContext = useRef(contextId);
  const previousLease = useRef(leaseId);
  useEffect(() => {
    const firstContext = previousContext.current === undefined && contextId !== undefined;
    // Initial native metadata may arrive after typing, including while Go blurs the field.
    if (
      previousLease.current !== leaseId ||
      (previousContext.current !== contextId && !(firstContext && edited.current))
    ) {
      setDraft(address);
      edited.current = false;
    }
    if (previousLease.current !== leaseId) setFocused(false);
    previousContext.current = contextId;
    previousLease.current = leaseId;
  }, [address, leaseId, contextId]);
  return {
    input,
    draft,
    value: focused ? draft : address,
    setDraft: (value: string) => {
      edited.current = true;
      setDraft(value);
    },
    focus: () => {
      edited.current = false;
      setDraft(address);
      setFocused(true);
      queueMicrotask(() => input.current?.select());
    },
    blur: () => setFocused(false),
    reset: () => {
      edited.current = false;
      setDraft(address);
      input.current?.blur();
    },
  };
};
