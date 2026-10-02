import type { SheetDescriptionProps } from '@/components/ui/sheet/types.ts';
import { cn } from '@/lib/utils';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';

export function SheetDescription({ className, ...props }: SheetDescriptionProps) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
