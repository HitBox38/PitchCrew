import type { CommandEmptyProps } from '@/components/ui/command/types.ts';
import { Command as CommandPrimitive } from 'cmdk';

export function CommandEmpty({ ...props }: CommandEmptyProps) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="py-6 text-center text-sm"
      {...props}
    />
  );
}
