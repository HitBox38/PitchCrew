import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const MessageFooter = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        'primitive:flex primitive:max-w-full primitive:min-w-0 primitive:items-center primitive:px-3 primitive:text-xs primitive:font-medium primitive:text-muted-foreground primitive:group-has-data-[variant=ghost]/message:px-0 primitive:group-data-[align=end]/message:justify-end',
        className,
      )}
      {...props}
    />
  );
};
