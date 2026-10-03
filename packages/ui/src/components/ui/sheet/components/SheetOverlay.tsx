import type { SheetOverlayProps } from '@/components/ui/sheet/types.ts';
import { cn } from '@/lib/utils';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export function SheetOverlay({ className, ...props }: SheetOverlayProps) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        'primitive:fixed primitive:inset-0 primitive:isolate primitive:z-50 primitive:bg-black/50',
        className,
      )}
      {...props}
    />
  );
}
