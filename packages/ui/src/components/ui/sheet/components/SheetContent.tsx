import { SheetOverlay } from '@/components/ui/sheet/components/SheetOverlay.tsx';
import { SheetPortal } from '@/components/ui/sheet/components/SheetPortal.tsx';
import type { SheetContentProps } from '@/components/ui/sheet/types.ts';
import { cn } from '@/lib/utils';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';

export function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          'primitive:fixed primitive:z-50 primitive:flex primitive:flex-col primitive:gap-4 primitive:bg-background primitive:shadow-lg',
          side === 'right' &&
            'primitive:inset-y-0 primitive:right-0 primitive:h-full primitive:w-3/4 primitive:border-l primitive:sm:max-w-sm',
          side === 'left' &&
            'primitive:inset-y-0 primitive:left-0 primitive:h-full primitive:w-3/4 primitive:border-r primitive:sm:max-w-sm',
          side === 'top' &&
            'primitive:inset-x-0 primitive:top-0 primitive:h-auto primitive:border-b',
          side === 'bottom' &&
            'primitive:inset-x-0 primitive:bottom-0 primitive:h-auto primitive:border-t',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="primitive:absolute primitive:top-4 primitive:right-4 primitive:rounded-xs primitive:opacity-70 primitive:ring-offset-background primitive:transition-opacity primitive:hover:opacity-100 primitive:focus:ring-2 primitive:focus:ring-ring primitive:focus:ring-offset-2 primitive:focus:outline-hidden primitive:disabled:pointer-events-none"
          >
            <XIcon className="primitive:size-4" />
            <span className="primitive:sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}
