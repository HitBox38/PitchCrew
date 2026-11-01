import type { ConversationProps } from '../types.ts';
import {
  MessageScroller,
  MessageScrollerProvider,
} from '@pitchcrew/design-system/message-scroller';

export const Conversation = ({
  autoScroll = true,
  defaultScrollPosition = 'end',
  ...props
}: ConversationProps) => (
  <MessageScrollerProvider autoScroll={autoScroll} defaultScrollPosition={defaultScrollPosition}>
    <MessageScroller {...props} />
  </MessageScrollerProvider>
);
