import type { SelectSeparatorProps } from '@/components/ui/select/types.ts';
import { cn } from '@/lib/utils';
import { Select as SelectPrimitive } from '@base-ui/react/select';

export function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}
