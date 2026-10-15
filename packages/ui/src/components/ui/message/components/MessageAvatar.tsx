import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export function MessageAvatar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        'primitive:flex primitive:w-fit primitive:min-w-8 primitive:shrink-0 primitive:items-center primitive:justify-center primitive:self-end primitive:overflow-hidden primitive:rounded-full primitive:bg-muted primitive:group-has-data-[slot=message-footer]/message:-translate-y-8',
        className,
      )}
      {...props}
    />
  );
}
