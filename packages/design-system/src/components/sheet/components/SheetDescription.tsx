import type { SheetDescriptionProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';

export const SheetDescription = ({ className, ...props }: SheetDescriptionProps) => {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('primitive:text-sm primitive:text-muted-foreground', className)}
      {...props}
    />
  );
};
