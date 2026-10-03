import type { CommandListProps } from '@/components/ui/command/types.ts';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';

export function CommandList({ className, ...props }: CommandListProps) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        'primitive:max-h-[300px] primitive:scroll-py-1 primitive:overflow-x-hidden primitive:overflow-y-auto',
        className,
      )}
      {...props}
    />
  );
}
