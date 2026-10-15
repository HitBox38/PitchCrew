import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export function AttachmentTitle({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="attachment-title"
      className={cn(
        'primitive:group-data-[state=processing]/attachment:shimmer primitive:group-data-[state=uploading]/attachment:shimmer primitive:block primitive:max-w-full primitive:min-w-0 primitive:truncate primitive:font-medium',
        className,
      )}
      {...props}
    />
  );
}
