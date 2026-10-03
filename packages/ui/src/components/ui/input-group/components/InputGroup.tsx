import type { InputGroupProps } from '@/components/ui/input-group/types.ts';
import { cn } from '@/lib/utils.ts';

export function InputGroup({ className, ...props }: InputGroupProps) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        'group/input-group primitive:relative primitive:flex primitive:h-9 primitive:w-full primitive:min-w-0 primitive:items-center primitive:rounded-md primitive:border primitive:border-input primitive:shadow-xs primitive:transition-[color,box-shadow] primitive:outline-none primitive:in-data-[slot=combobox-content]:focus-within:border-inherit primitive:in-data-[slot=combobox-content]:focus-within:ring-0 primitive:has-[[data-slot=input-group-control]:focus-visible]:border-ring primitive:has-[[data-slot=input-group-control]:focus-visible]:ring-3 primitive:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 primitive:has-[[data-slot][aria-invalid=true]]:border-destructive primitive:has-[[data-slot][aria-invalid=true]]:ring-3 primitive:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 primitive:has-[>[data-align=block-end]]:h-auto primitive:has-[>[data-align=block-end]]:flex-col primitive:has-[>[data-align=block-start]]:h-auto primitive:has-[>[data-align=block-start]]:flex-col primitive:has-[>textarea]:h-auto primitive:dark:bg-input/30 primitive:dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 primitive:has-[>[data-align=block-end]]:[&>input]:pt-3 primitive:has-[>[data-align=block-start]]:[&>input]:pb-3 primitive:has-[>[data-align=inline-end]]:[&>input]:pr-1.5 primitive:has-[>[data-align=inline-start]]:[&>input]:pl-1.5',
        className,
      )}
      {...props}
    />
  );
}
