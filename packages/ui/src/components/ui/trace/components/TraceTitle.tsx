import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const TraceTitle = ({ className, ...props }: React.ComponentProps<'span'>) => {
  return (
    <span
      data-slot="trace-title"
      className={cn(
        'primitive:motion-reduce:shimmer-none primitive:min-w-0 primitive:truncate',
        className,
      )}
      {...props}
    />
  );
};
