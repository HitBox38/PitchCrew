import { useContext } from 'react';
import type { MessageContentProps } from '../types.ts';
import { MessageRoleContext } from '../context.ts';
import { MessageContent as MessageBody } from '@pitchcrew/design-system/message';
import { Bubble, BubbleContent } from '@pitchcrew/design-system/bubble';

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
