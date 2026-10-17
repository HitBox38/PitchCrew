import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export function Trace({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="trace"
      className={cn(
        'primitive:flex primitive:w-full primitive:min-w-0 primitive:flex-col primitive:gap-2 primitive:*:has-[>[data-slot=trace-line]]:flex primitive:*:has-[>[data-slot=trace-line]]:w-fit primitive:*:has-[>[data-slot=trace-line]]:max-w-full primitive:*:has-[>[data-slot=trace-line]]:min-w-0 primitive:*:has-[>[data-slot=trace-line]]:rounded-md primitive:*:has-[>[data-slot=trace-line]]:text-left primitive:*:has-[>[data-slot=trace-line]]:outline-none primitive:*:has-[>[data-slot=trace-line]]:focus-visible:ring-3 primitive:*:has-[>[data-slot=trace-line]]:focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    />
  );
}
