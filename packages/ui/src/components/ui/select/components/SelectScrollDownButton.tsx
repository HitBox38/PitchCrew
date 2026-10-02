import type { SelectScrollDownButtonProps } from '@/components/ui/select/types.ts';
import { cn } from '@/lib/utils';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronDownIcon } from 'lucide-react';

export function SelectScrollDownButton({ className, ...props }: SelectScrollDownButtonProps) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        'bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1',
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}
