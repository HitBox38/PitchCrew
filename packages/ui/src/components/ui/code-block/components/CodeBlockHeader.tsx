import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export function CodeBlockHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="code-block-header"
      className={cn(
        'primitive:flex primitive:min-w-0 primitive:shrink-0 primitive:items-center primitive:gap-2 primitive:px-4 primitive:pt-4 primitive:text-muted-foreground primitive:group-data-[size=sm]/code-block:px-3 primitive:group-data-[size=sm]/code-block:pt-3 primitive:group-data-[variant=destructive]/code-block:text-destructive primitive:*:has-[>[data-slot=code-block-title]]:min-w-0',
        className,
      )}
      {...props}
    />
  );
}
