import { DialogOverlay } from '@/components/ui/dialog/components/DialogOverlay.tsx';
import { DialogPortal } from '@/components/ui/dialog/components/DialogPortal.tsx';
import type { DialogContentProps } from '@/components/ui/dialog/types.ts';
import { cn } from '@/lib/utils';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  motion = true,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay data-motion={motion} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-motion={motion}
        className={cn(
          'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg outline-none sm:max-w-lg',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}
