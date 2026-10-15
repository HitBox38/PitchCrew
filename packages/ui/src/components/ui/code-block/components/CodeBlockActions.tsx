import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export function CodeBlockActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="code-block-actions"
      className={cn(
        'primitive:-my-1 primitive:ms-auto primitive:-me-1.5 primitive:flex primitive:shrink-0 primitive:items-center primitive:gap-1 primitive:[[data-slot=code-block]>&]:absolute primitive:[[data-slot=code-block]>&]:end-3 primitive:[[data-slot=code-block]>&]:top-3 primitive:[[data-slot=code-block]>&]:z-10 primitive:[[data-slot=code-block]>&]:m-0 primitive:[[data-slot=code-block]>&]:opacity-0 primitive:[[data-slot=code-block]>&]:transition-opacity primitive:[[data-slot=code-block]>&]:group-focus-within/code-block:opacity-100 primitive:[[data-slot=code-block]>&]:group-hover/code-block:opacity-100 primitive:group-data-[size=sm]/code-block:[[data-slot=code-block]>&]:end-2 primitive:group-data-[size=sm]/code-block:[[data-slot=code-block]>&]:top-2 primitive:[[data-slot=code-block]>&]:pointer-coarse:opacity-100 primitive:[[data-slot=code-block]>&]:*:[button]:bg-background primitive:[[data-slot=code-block]>&]:*:[button]:ring-1 primitive:[[data-slot=code-block]>&]:*:[button]:ring-foreground/10',
        className,
      )}
      {...props}
    />
  );
}
