import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const BubbleGroup = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="bubble-group"
      className={cn(
        'primitive:flex primitive:min-w-0 primitive:flex-col primitive:gap-2',
        className,
      )}
      {...props}
    />
  );
};
