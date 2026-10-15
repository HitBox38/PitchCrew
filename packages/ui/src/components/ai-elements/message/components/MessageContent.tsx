import { useContext } from 'react';
import type { MessageContentProps } from '../types.ts';
import { MessageRoleContext } from '../context.ts';
import { MessageContent as MessageBody } from '@/components/ui/message/components/MessageContent.tsx';
import { Bubble } from '@/components/ui/bubble/components/Bubble.tsx';
import { BubbleContent } from '@/components/ui/bubble/components/BubbleContent.tsx';

export const MessageContent = ({ children, ...props }: MessageContentProps) => {
  const from = useContext(MessageRoleContext);
  return from === 'user' ? (
    <MessageBody>
      <Bubble align="end" variant="muted" className="max-w-full">
        <BubbleContent {...props}>{children}</BubbleContent>
      </Bubble>
    </MessageBody>
  ) : (
    <MessageBody {...props}>{children}</MessageBody>
  );
};
