import type { CommandInputProps } from '@/components/ui/command/types.ts';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';

export function CommandInput({ className, ...props }: CommandInputProps) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="primitive:flex primitive:h-9 primitive:items-center primitive:gap-2 primitive:border-b primitive:px-3"
    >
      <SearchIcon className="primitive:size-4 primitive:shrink-0 primitive:opacity-50" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          'primitive:flex primitive:h-10 primitive:w-full primitive:rounded-md primitive:bg-transparent primitive:py-3 primitive:text-sm primitive:outline-hidden primitive:placeholder:text-muted-foreground primitive:disabled:cursor-not-allowed primitive:disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
}
