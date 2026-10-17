import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { MessageScroller as MessageScrollerPrimitive } from '@shadcn/react/message-scroller';

export function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn(
        'primitive:scroll-fade-b primitive:size-full primitive:min-h-0 primitive:min-w-0 primitive:scrollbar-thin primitive:scrollbar-gutter-stable primitive:overflow-y-auto primitive:overscroll-contain primitive:contain-content primitive:data-autoscrolling:scrollbar-thumb-transparent primitive:data-autoscrolling:scrollbar-track-transparent primitive:data-pending-scroll:invisible',
        className,
      )}
      {...props}
    />
  );
}
