import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import { SheetOverlay } from '@/components/ui/sheet/components/SheetOverlay.tsx';
import { SheetPortal } from '@/components/ui/sheet/components/SheetPortal.tsx';
import type { SheetContentProps } from '@/components/ui/sheet/types.ts';
import { cn } from '@/lib/utils';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import * as m from 'motion/react-m';

export function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  const reduced = useAppReducedMotion();
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        render={
          <m.div
            initial={
              reduced
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    x: side === 'right' ? 48 : side === 'left' ? -48 : 0,
                    y: side === 'top' ? -48 : side === 'bottom' ? 48 : 0,
                  }
            }
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{
              opacity: 0,
              x: reduced ? 0 : side === 'right' ? 32 : side === 'left' ? -32 : 0,
              y: reduced ? 0 : side === 'top' ? -32 : side === 'bottom' ? 32 : 0,
              transition: { duration: 0.18 },
            }}
          />
        }
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          'fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-closed:animate-out data-closed:duration-300',
          side === 'right' &&
            'inset-y-0 right-0 h-full w-3/4 border-l data-closed:slide-out-to-right sm:max-w-sm',
          side === 'left' &&
            'inset-y-0 left-0 h-full w-3/4 border-r data-closed:slide-out-to-left sm:max-w-sm',
          side === 'top' && 'inset-x-0 top-0 h-auto border-b data-closed:slide-out-to-top',
          side === 'bottom' && 'inset-x-0 bottom-0 h-auto border-t data-closed:slide-out-to-bottom',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}
