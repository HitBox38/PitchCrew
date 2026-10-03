import type { CommandSeparatorProps } from '@/components/ui/command/types.ts';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';

export function CommandSeparator({ className, ...props }: CommandSeparatorProps) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('primitive:-mx-1 primitive:h-px primitive:bg-border', className)}
      {...props}
    />
  );
}
