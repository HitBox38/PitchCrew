import { useEffect, useRef } from 'react';

/** Navigation updates the location bar without overwriting a human's focused draft. */
export const useBrowserAddress = (
  address: string,
  leaseId: string | undefined,
  contextId?: string,
) => {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const field = input.current;
    if (field && document.activeElement !== field) field.value = address;
  }, [address, leaseId, contextId]);
  return input;
};
