import { Button } from '../../button/components/Button.tsx';
import type { DialogFooterProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export const DialogFooter = ({
  className,
  showCloseButton = false,
  children,
  ...props
}: DialogFooterProps) => {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'primitive:flex primitive:flex-col-reverse primitive:gap-2 primitive:sm:flex-row primitive:sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  );
};
