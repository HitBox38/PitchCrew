import type { SheetHeaderProps } from '@/components/ui/sheet/types.ts';
import { cn } from '@/lib/utils';

export function SheetHeader({ className, ...props }: SheetHeaderProps) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('primitive:flex primitive:flex-col primitive:gap-1.5 primitive:p-4', className)}
      {...props}
    />
  );
}
