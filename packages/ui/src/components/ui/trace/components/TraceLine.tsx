import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const TraceLine = ({
  className,
  status,
  ...props
}: React.ComponentProps<'span'> & {
  status?: 'running' | 'error' | 'pending';
}) => {
  return (
    <span
      data-slot="trace-line"
      data-status={status}
      className={cn(
        'primitive:data-[status=running]:*:data-[slot=trace-title]:shimmer primitive:flex primitive:w-fit primitive:max-w-full primitive:min-w-0 primitive:items-center primitive:gap-2 primitive:text-sm primitive:text-muted-foreground primitive:transition-colors primitive:in-[a,button]:cursor-pointer primitive:in-[a:hover,button:hover]:text-foreground primitive:data-[status=error]:text-destructive primitive:data-[status=error]:in-[a:hover,button:hover]:text-destructive primitive:data-[status=pending]:opacity-60',
        className,
      )}
      {...props}
    />
  );
};
