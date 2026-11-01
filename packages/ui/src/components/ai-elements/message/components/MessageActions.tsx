import type { MessageActionsProps } from '../types.ts';
import { MessageFooter } from '@pitchcrew/design-system/message';
import { cn } from '@pitchcrew/design-system/utils';
export const MessageActions = ({ className, ...props }: MessageActionsProps) => (
  <MessageFooter className={cn('primitive:gap-1', className)} {...props} />
);
