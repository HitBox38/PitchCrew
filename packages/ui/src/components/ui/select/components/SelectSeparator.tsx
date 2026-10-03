import type { SelectSeparatorProps } from '@/components/ui/select/types.ts';
import { cn } from '@/lib/utils';
import { Select as SelectPrimitive } from '@base-ui/react/select';

export function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(
        'primitive:pointer-events-none primitive:-mx-1 primitive:my-1 primitive:h-px primitive:bg-border',
        className,
      )}
      {...props}
    />
  );
}
