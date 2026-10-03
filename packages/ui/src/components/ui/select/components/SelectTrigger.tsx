import type { SelectTriggerProps } from '@/components/ui/select/types.ts';
import { cn } from '@/lib/utils';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronDownIcon } from 'lucide-react';

export function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "primitive:flex primitive:w-fit primitive:items-center primitive:justify-between primitive:gap-2 primitive:rounded-md primitive:border primitive:border-input primitive:bg-transparent primitive:px-3 primitive:py-2 primitive:text-sm primitive:whitespace-nowrap primitive:shadow-xs primitive:transition-[color,box-shadow] primitive:outline-none primitive:focus-visible:border-ring primitive:focus-visible:ring-[3px] primitive:focus-visible:ring-ring/50 primitive:disabled:cursor-not-allowed primitive:disabled:opacity-50 primitive:aria-invalid:border-destructive primitive:aria-invalid:ring-destructive/20 primitive:data-placeholder:text-muted-foreground primitive:data-[size=default]:h-9 primitive:data-[size=sm]:h-8 primitive:*:data-[slot=select-value]:line-clamp-1 primitive:*:data-[slot=select-value]:flex primitive:*:data-[slot=select-value]:items-center primitive:*:data-[slot=select-value]:gap-2 primitive:dark:bg-input/30 primitive:dark:hover:bg-input/50 primitive:dark:aria-invalid:ring-destructive/40 primitive:[&_svg]:pointer-events-none primitive:[&_svg]:shrink-0 primitive:[&_svg:not([class*='size-'])]:size-4 primitive:[&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDownIcon className="primitive:size-4 primitive:opacity-50" />}
      />
    </SelectPrimitive.Trigger>
  );
}
