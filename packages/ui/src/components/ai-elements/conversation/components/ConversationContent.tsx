import type { ConversationContentProps } from '../types.ts';
import { MessageScrollerContent } from '@/components/ui/message-scroller/components/MessageScrollerContent.tsx';
import { MessageScrollerViewport } from '@/components/ui/message-scroller/components/MessageScrollerViewport.tsx';

export const ConversationContent = ({ scrollClassName, ...props }: ConversationContentProps) => (
  <MessageScrollerViewport className={scrollClassName}>
    <MessageScrollerContent {...props} />
  </MessageScrollerViewport>
);
