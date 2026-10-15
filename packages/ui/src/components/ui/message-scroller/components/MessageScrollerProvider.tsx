import * as React from 'react';
import { MessageScroller as MessageScrollerPrimitive } from '@shadcn/react/message-scroller';

export function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
  return <MessageScrollerPrimitive.Provider {...props} />;
}
