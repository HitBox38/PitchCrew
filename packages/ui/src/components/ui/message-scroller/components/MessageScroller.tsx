import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { MessageScroller as MessageScrollerPrimitive } from '@shadcn/react/message-scroller';

export const MessageScroller = ({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) => {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        'group/message-scroller primitive:relative primitive:flex primitive:size-full primitive:min-h-0 primitive:flex-col primitive:overflow-hidden',
        className,
      )}
      {...props}
    />
  );
};
