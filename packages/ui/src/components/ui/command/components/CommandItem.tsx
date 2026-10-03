import type { CommandItemProps } from '@/components/ui/command/types.ts';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';

export function CommandItem({ className, ...props }: CommandItemProps) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "primitive:relative primitive:flex primitive:cursor-default primitive:items-center primitive:gap-2 primitive:rounded-sm primitive:px-2 primitive:py-1.5 primitive:text-sm primitive:outline-hidden primitive:select-none primitive:data-[disabled=true]:pointer-events-none primitive:data-[disabled=true]:opacity-50 primitive:data-[selected=true]:bg-accent primitive:data-[selected=true]:text-accent-foreground primitive:[&_svg]:pointer-events-none primitive:[&_svg]:shrink-0 primitive:[&_svg:not([class*='size-'])]:size-4 primitive:[&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
