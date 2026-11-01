import type { SheetTitleProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';

export const SheetTitle = ({ className, ...props }: SheetTitleProps) => {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('primitive:font-semibold primitive:text-foreground', className)}
      {...props}
    />
  );
};
