import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const AttachmentDescription = ({ className, ...props }: React.ComponentProps<'span'>) => {
  return (
    <span
      data-slot="attachment-description"
      className={cn(
        'primitive:mt-0.5 primitive:block primitive:min-w-0 primitive:truncate primitive:text-xs primitive:text-muted-foreground primitive:group-data-[state=error]/attachment:text-destructive/80',
        'max-w-full',
        className,
      )}
      {...props}
    />
  );
};
