import type { DialogHeaderProps } from '@/components/ui/dialog/types.ts';
import { cn } from '@/lib/utils';

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        'primitive:flex primitive:flex-col primitive:gap-2 primitive:text-center primitive:sm:text-left',
        className,
      )}
      {...props}
    />
  );
}
