import type { CommandSeparatorProps } from '@/components/ui/command/types.ts';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';

export function CommandSeparator({ className, ...props }: CommandSeparatorProps) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('-mx-1 h-px bg-border', className)}
      {...props}
    />
  );
}
