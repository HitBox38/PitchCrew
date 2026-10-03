import type { MessageResponseProps } from '@/components/ai-elements/message/types.ts';
import { cn } from '@/lib/utils.ts';
import { memo } from 'react';
import { Streamdown } from 'streamdown';

export const MessageResponse = memo(({ className, ...props }: MessageResponseProps) => (
  <Streamdown
    className={cn(
      'primitive:size-full primitive:[&>*:first-child]:mt-0 primitive:[&>*:last-child]:mb-0',
      className,
    )}
    {...props}
  />
));
