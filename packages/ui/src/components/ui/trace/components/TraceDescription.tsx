import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const TraceDescription = ({ className, ...props }: React.ComponentProps<'span'>) => {
  return (
    <span
      data-slot="trace-description"
      className={cn(
        'primitive:shrink-0 primitive:text-muted-foreground/70 primitive:tabular-nums',
        className,
      )}
      {...props}
    />
  );
};
