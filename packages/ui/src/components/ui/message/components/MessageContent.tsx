import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const MessageContent = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="message-content"
      className={cn(
        'primitive:flex primitive:w-full primitive:min-w-0 primitive:flex-col primitive:gap-2.5 primitive:wrap-break-word primitive:group-data-[align=end]/message:*:data-slot:self-end',
        className,
      )}
      {...props}
    />
  );
};
