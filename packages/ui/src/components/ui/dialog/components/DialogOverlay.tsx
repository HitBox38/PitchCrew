import type { DialogOverlayProps } from '@/components/ui/dialog/types.ts';
import { cn } from '@/lib/utils';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import * as m from 'motion/react-m';

export function DialogOverlay({ className, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Backdrop
      render={
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        />
      }
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-50 bg-black/50 data-closed:animate-out data-closed:fade-out-0',
        className,
      )}
      {...props}
    />
  );
}
