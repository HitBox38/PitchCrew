import type { SelectItemProps } from '@/components/ui/select/types.ts';
import { cn } from '@/lib/utils';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { CheckIcon } from 'lucide-react';

export function SelectItem({ className, children, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "primitive:relative primitive:flex primitive:w-full primitive:cursor-default primitive:items-center primitive:gap-2 primitive:rounded-sm primitive:py-1.5 primitive:pr-8 primitive:pl-2 primitive:text-sm primitive:outline-hidden primitive:select-none primitive:focus:bg-accent primitive:focus:text-accent-foreground primitive:data-disabled:pointer-events-none primitive:data-disabled:opacity-50 primitive:[&_svg]:pointer-events-none primitive:[&_svg]:shrink-0 primitive:[&_svg:not([class*='size-'])]:size-4 primitive:[&_svg:not([class*='text-'])]:text-muted-foreground primitive:*:[span]:last:flex primitive:*:[span]:last:items-center primitive:*:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="primitive:flex primitive:flex-1 primitive:shrink-0 primitive:gap-2 primitive:whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="primitive:pointer-events-none primitive:absolute primitive:right-2 primitive:flex primitive:size-3.5 primitive:items-center primitive:justify-center" />
        }
      >
        <CheckIcon className="primitive:size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
