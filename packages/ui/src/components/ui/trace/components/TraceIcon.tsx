import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export function TraceIcon({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="trace-icon"
      aria-hidden="true"
      className={cn(
        "primitive:flex primitive:size-4 primitive:shrink-0 primitive:items-center primitive:justify-center primitive:[&_svg]:pointer-events-none primitive:[&_svg:not([class*='size-'])]:size-4 primitive:[[data-slot=trace-title]~&]:-ml-1",
        className,
      )}
      {...props}
    />
  );
}
