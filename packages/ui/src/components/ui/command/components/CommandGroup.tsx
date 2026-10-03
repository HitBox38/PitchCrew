import type { CommandGroupProps } from '@/components/ui/command/types.ts';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';

export function CommandGroup({ className, ...props }: CommandGroupProps) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        'primitive:overflow-hidden primitive:p-1 primitive:text-foreground primitive:[&_[cmdk-group-heading]]:px-2 primitive:[&_[cmdk-group-heading]]:py-1.5 primitive:[&_[cmdk-group-heading]]:text-xs primitive:[&_[cmdk-group-heading]]:font-medium primitive:[&_[cmdk-group-heading]]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
