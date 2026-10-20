import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const AttachmentContent = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="attachment-content"
      className={cn(
        'primitive:max-w-full primitive:min-w-0 primitive:flex-1 primitive:leading-tight primitive:group-data-[orientation=vertical]/attachment:px-1',
        className,
      )}
      {...props}
    />
  );
};
