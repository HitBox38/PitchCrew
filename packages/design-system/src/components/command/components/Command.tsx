import type { CommandProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Command as CommandPrimitive } from 'cmdk';

export const Command = ({ className, ...props }: CommandProps) => {
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
};
