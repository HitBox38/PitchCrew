import type { SelectScrollUpButtonProps } from '@/components/ui/select/types.ts';
import { cn } from '@/lib/utils';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronUpIcon } from 'lucide-react';

export function SelectScrollUpButton({ className, ...props }: SelectScrollUpButtonProps) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        'top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1',
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}
