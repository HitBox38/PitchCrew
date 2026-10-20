import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const AttachmentGroup = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="attachment-group"
      className={cn(
        'primitive:scroll-fade-x primitive:flex primitive:min-w-0 primitive:snap-x primitive:snap-mandatory primitive:scroll-px-1 primitive:scrollbar-none primitive:gap-3 primitive:overflow-x-auto primitive:overscroll-x-contain primitive:py-1 primitive:*:data-[slot=attachment]:flex-none primitive:*:data-[slot=attachment]:snap-start',
        className,
      )}
      {...props}
    />
  );
};
