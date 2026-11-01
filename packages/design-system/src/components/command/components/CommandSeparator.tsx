import type { CommandSeparatorProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Command as CommandPrimitive } from 'cmdk';

export const CommandSeparator = ({ className, ...props }: CommandSeparatorProps) => {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('primitive:-mx-1 primitive:h-px primitive:bg-border', className)}
      {...props}
    />
  );
};
