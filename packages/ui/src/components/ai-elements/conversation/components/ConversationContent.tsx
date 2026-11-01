import type { ConversationContentProps } from '../types.ts';
import {
  MessageScrollerContent,
  MessageScrollerViewport,
} from '@pitchcrew/design-system/message-scroller';

export const ConversationContent = ({ scrollClassName, ...props }: ConversationContentProps) => (
  <MessageScrollerViewport className={scrollClassName}>
    <MessageScrollerContent {...props} />
  </MessageScrollerViewport>
);
