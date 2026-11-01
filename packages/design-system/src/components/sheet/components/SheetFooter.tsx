import type { SheetFooterProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const SheetFooter = ({ className, ...props }: SheetFooterProps) => {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        'primitive:mt-auto primitive:flex primitive:flex-col primitive:gap-2 primitive:p-4',
        className,
      )}
      {...props}
    />
  );
};
