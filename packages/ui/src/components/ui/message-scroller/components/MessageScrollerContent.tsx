import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { MessageScroller as MessageScrollerPrimitive } from '@shadcn/react/message-scroller';

export function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn(
        'primitive:flex primitive:h-max primitive:min-h-full primitive:flex-col primitive:gap-8',
        className,
      )}
      {...props}
    />
  );
}
