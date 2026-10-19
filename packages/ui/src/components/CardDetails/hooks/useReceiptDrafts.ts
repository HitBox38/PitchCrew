import { useCallback, useEffect, useState } from 'react';

export function useReceiptDrafts(onDirtyChange?: (dirty: boolean) => void) {
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const changeDirty = useCallback(
    (id: string, value: boolean) =>
      setDirty((current) => (current[id] === value ? current : { ...current, [id]: value })),
    [],
  );
  const hasDraft = Object.values(dirty).some(Boolean);
  useEffect(() => {
    onDirtyChange?.(hasDraft);
    return () => onDirtyChange?.(false);
  }, [hasDraft, onDirtyChange]);
  return changeDirty;
}
