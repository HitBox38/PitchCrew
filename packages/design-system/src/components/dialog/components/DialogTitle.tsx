import type { DialogTitleProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export const DialogTitle = ({ className, ...props }: DialogTitleProps) => {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('primitive:text-lg primitive:leading-none primitive:font-semibold', className)}
      {...props}
    />
  );
};
