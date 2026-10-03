import type { DialogOverlayProps } from '@/components/ui/dialog/types.ts';
import { cn } from '@/lib/utils';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export function DialogOverlay({ className, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn('fixed inset-0 isolate z-50 bg-black/50', className)}
      {...props}
    />
  );
}
