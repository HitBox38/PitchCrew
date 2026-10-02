import { Button } from '@/components/ui/button/components/Button.tsx';
import type { DialogFooterProps } from '@/components/ui/dialog/types.ts';
import { cn } from '@/lib/utils';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  );
}
