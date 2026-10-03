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
          'primitive:fixed primitive:top-[50%] primitive:left-[50%] primitive:z-50 primitive:grid primitive:w-full primitive:max-w-[calc(100%-2rem)] primitive:translate-x-[-50%] primitive:translate-y-[-50%] primitive:gap-4 primitive:rounded-lg primitive:border primitive:bg-background primitive:p-6 primitive:shadow-lg primitive:outline-none primitive:sm:max-w-lg',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="primitive:absolute primitive:top-4 primitive:right-4 primitive:rounded-xs primitive:opacity-70 primitive:ring-offset-background primitive:transition-opacity primitive:hover:opacity-100 primitive:focus:ring-2 primitive:focus:ring-ring primitive:focus:ring-offset-2 primitive:focus:outline-hidden primitive:disabled:pointer-events-none primitive:[&_svg]:pointer-events-none primitive:[&_svg]:shrink-0 primitive:[&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="primitive:sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}
