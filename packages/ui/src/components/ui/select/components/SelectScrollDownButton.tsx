import type { SelectScrollDownButtonProps } from '@/components/ui/select/types.ts';
import { cn } from '@/lib/utils';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronDownIcon } from 'lucide-react';

export function SelectScrollDownButton({ className, ...props }: SelectScrollDownButtonProps) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        'primitive:bottom-0 primitive:z-10 primitive:flex primitive:w-full primitive:cursor-default primitive:items-center primitive:justify-center primitive:bg-popover primitive:py-1',
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="primitive:size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}
