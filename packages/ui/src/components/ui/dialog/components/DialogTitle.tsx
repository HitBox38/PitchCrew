import type { DialogTitleProps } from '@/components/ui/dialog/types.ts';
import { cn } from '@/lib/utils';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  );
}
