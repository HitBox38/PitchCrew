import type { ConversationProps } from '../types.ts';
import { MessageScroller } from '@/components/ui/message-scroller/components/MessageScroller.tsx';
import { MessageScrollerProvider } from '@/components/ui/message-scroller/components/MessageScrollerProvider.tsx';

export const Conversation = ({
  autoScroll = true,
  defaultScrollPosition = 'end',
  ...props
}: ConversationProps) => (
  <MessageScrollerProvider autoScroll={autoScroll} defaultScrollPosition={defaultScrollPosition}>
    <MessageScroller {...props} />
  </MessageScrollerProvider>
);
