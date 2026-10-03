import type { ConversationProps } from '@/components/ai-elements/conversation/types.ts';
import { cn } from '@/lib/utils.ts';
import { StickToBottom } from 'use-stick-to-bottom';

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn('primitive:relative primitive:flex-1 primitive:overflow-y-hidden', className)}
    initial="instant"
    resize="instant"
    role="log"
    {...props}
  />
);
