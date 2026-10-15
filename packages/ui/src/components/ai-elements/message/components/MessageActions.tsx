import type { MessageActionsProps } from '../types.ts';
import { MessageFooter } from '@/components/ui/message/components/MessageFooter.tsx';
import { cn } from '@/lib/utils.ts';
export const MessageActions = ({ className, ...props }: MessageActionsProps) => (
  <MessageFooter className={cn('primitive:gap-1', className)} {...props} />
);
