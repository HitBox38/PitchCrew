import { useDirtyNotification } from '@/hooks/useDirtyNotification.ts';
import { useCallback, useState } from 'react';

export const useReceiptDrafts = (onDirtyChange?: (dirty: boolean) => void) => {
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const changeDirty = useCallback(
    (id: string, value: boolean) =>
      setDirty((current) => (current[id] === value ? current : { ...current, [id]: value })),
    [],
  );
  const hasDraft = Object.values(dirty).some(Boolean);
  useDirtyNotification(hasDraft, onDirtyChange);
  return changeDirty;
};
