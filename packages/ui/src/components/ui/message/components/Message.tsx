import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export function Message({
  className,
  align = 'start',
  ...props
}: React.ComponentProps<'div'> & { align?: 'start' | 'end' }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        'group/message primitive:relative primitive:flex primitive:w-full primitive:min-w-0 primitive:gap-2 primitive:text-sm primitive:data-[align=end]:flex-row-reverse',
        className,
      )}
      {...props}
    />
  );
}
