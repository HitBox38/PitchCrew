import type { SheetHeaderProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const SheetHeader = ({ className, ...props }: SheetHeaderProps) => {
  return (
    <div
      data-slot="sheet-header"
      className={cn('primitive:flex primitive:flex-col primitive:gap-1.5 primitive:p-4', className)}
      {...props}
    />
  );
};
