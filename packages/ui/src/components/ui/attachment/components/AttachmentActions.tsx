import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const AttachmentActions = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="attachment-actions"
      className={cn(
        'primitive:relative primitive:z-20 primitive:flex primitive:shrink-0 primitive:items-center primitive:group-data-[orientation=vertical]/attachment:absolute primitive:group-data-[orientation=vertical]/attachment:top-3 primitive:group-data-[orientation=vertical]/attachment:right-3 primitive:group-data-[orientation=vertical]/attachment:gap-1',
        className,
      )}
      {...props}
    />
  );
};
