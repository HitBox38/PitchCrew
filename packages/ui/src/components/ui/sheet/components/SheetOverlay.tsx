import type { SheetOverlayProps } from '@/components/ui/sheet/types.ts';
import { cn } from '@/lib/utils';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import * as m from 'motion/react-m';

export function SheetOverlay({ className, ...props }: SheetOverlayProps) {
  return (
    <SheetPrimitive.Backdrop
      render={
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        />
      }
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/50 data-closed:animate-out data-closed:fade-out-0',
        className,
      )}
      {...props}
    />
  );
}
