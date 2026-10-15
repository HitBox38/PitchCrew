import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { MessageScroller as MessageScrollerPrimitive } from '@shadcn/react/message-scroller';

export function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn(
        'primitive:min-w-0 primitive:shrink-0 primitive:[contain-intrinsic-size:auto_10rem] primitive:[content-visibility:auto]',
        className,
      )}
      {...props}
    />
  );
}
