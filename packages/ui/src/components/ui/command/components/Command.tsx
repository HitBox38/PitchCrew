import type { CommandProps } from '@/components/ui/command/types.ts';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';

export function Command({ className, ...props }: CommandProps) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
        className,
      )}
      {...props}
    />
  );
}
