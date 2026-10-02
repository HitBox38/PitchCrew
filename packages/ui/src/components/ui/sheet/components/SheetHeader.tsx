import type { SheetHeaderProps } from '@/components/ui/sheet/types.ts';
import { cn } from '@/lib/utils';

export function SheetHeader({ className, ...props }: SheetHeaderProps) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  );
}
