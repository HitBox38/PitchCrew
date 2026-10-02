import type { ConversationContentProps } from '@/components/ai-elements/conversation/types.ts';
import { cn } from '@/lib/utils.ts';
import { StickToBottom } from 'use-stick-to-bottom';

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
  <StickToBottom.Content className={cn('flex flex-col gap-8 p-4', className)} {...props} />
);
