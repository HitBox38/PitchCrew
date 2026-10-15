import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export function CodeBlockTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="code-block-title"
      className={cn(
        "primitive:min-w-0 primitive:truncate primitive:font-sans primitive:text-sm primitive:font-medium primitive:text-foreground primitive:group-data-[size=sm]/code-block:text-xs primitive:group-data-[variant=destructive]/code-block:text-destructive primitive:[&_svg]:pointer-events-none primitive:[&_svg]:inline-block primitive:[&_svg]:align-middle primitive:[&_svg:not([class*='size-'])]:size-4 primitive:group-data-[size=sm]/code-block:[&_svg:not([class*='size-'])]:size-3.5 primitive:*:[svg]:me-1.5",
        className,
      )}
      {...props}
    />
  );
}
