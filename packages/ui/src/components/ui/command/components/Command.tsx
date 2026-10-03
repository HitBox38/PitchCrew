import type { CommandProps } from '@/components/ui/command/types.ts';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';

export function Command({ className, ...props }: CommandProps) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'primitive:flex primitive:h-full primitive:w-full primitive:flex-col primitive:overflow-hidden primitive:rounded-md primitive:bg-popover primitive:text-popover-foreground',
        className,
      )}
      {...props}
    />
  );
}
