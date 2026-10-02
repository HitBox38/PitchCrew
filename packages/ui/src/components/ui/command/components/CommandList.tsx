import type { CommandListProps } from '@/components/ui/command/types.ts';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';

export function CommandList({ className, ...props }: CommandListProps) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn('max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto', className)}
      {...props}
    />
  );
}
