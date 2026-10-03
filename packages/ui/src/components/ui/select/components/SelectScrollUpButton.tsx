import type { SelectScrollUpButtonProps } from '@/components/ui/select/types.ts';
import { cn } from '@/lib/utils';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronUpIcon } from 'lucide-react';

export function SelectScrollUpButton({ className, ...props }: SelectScrollUpButtonProps) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        'primitive:top-0 primitive:z-10 primitive:flex primitive:w-full primitive:cursor-default primitive:items-center primitive:justify-center primitive:bg-popover primitive:py-1',
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="primitive:size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}
