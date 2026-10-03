import type { ConversationContentProps } from '@/components/ai-elements/conversation/types.ts';
import { cn } from '@/lib/utils.ts';
import { StickToBottom } from 'use-stick-to-bottom';

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
  <StickToBottom.Content
    className={cn('primitive:flex primitive:flex-col primitive:gap-8 primitive:p-4', className)}
    {...props}
  />
);
