import type { SelectLabelProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Select as SelectPrimitive } from '@base-ui/react/select';

export const SelectLabel = ({ className, ...props }: SelectLabelProps) => {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        'primitive:px-2 primitive:py-1.5 primitive:text-xs primitive:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
};
