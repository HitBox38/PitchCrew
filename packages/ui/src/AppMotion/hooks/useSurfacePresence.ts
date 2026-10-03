import { useEffect } from 'react';
import { usePresence } from 'motion/react';
import type { DialogProps } from '@/components/ui/dialog/types.ts';

export function useSurfacePresence({ open, onOpenChangeComplete, ...props }: DialogProps) {
  const [present, remove] = usePresence();
  useEffect(() => {
    if (!present && !open) remove?.();
  }, [present, open, remove]);
  return {
    ...props,
    open: present ? open : false,
    onOpenChangeComplete: (next: boolean) => {
      onOpenChangeComplete?.(next);
      if (!next && !present) remove?.();
    },
  };
}
