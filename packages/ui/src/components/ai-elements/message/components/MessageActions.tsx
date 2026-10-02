import type { MessageActionsProps } from '@/components/ai-elements/message/types.ts';
import { cn } from '@/lib/utils.ts';

export const MessageActions = ({ className, children, ...props }: MessageActionsProps) => (
  <div className={cn('flex items-center gap-1', className)} {...props}>
    {children}
  </div>
);
