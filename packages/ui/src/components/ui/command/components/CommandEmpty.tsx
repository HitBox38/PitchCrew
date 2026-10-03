import type { CommandEmptyProps } from '@/components/ui/command/types.ts';
import { Command as CommandPrimitive } from 'cmdk';

export function CommandEmpty({ ...props }: CommandEmptyProps) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="primitive:py-6 primitive:text-center primitive:text-sm"
      {...props}
    />
  );
}
