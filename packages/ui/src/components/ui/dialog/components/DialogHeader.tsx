import type { DialogHeaderProps } from '@/components/ui/dialog/types.ts';
import { cn } from '@/lib/utils';

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}
