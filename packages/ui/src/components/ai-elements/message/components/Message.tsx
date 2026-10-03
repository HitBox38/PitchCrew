import type { MessageProps } from '@/components/ai-elements/message/types.ts';
import { cn } from '@/lib/utils.ts';

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      'group primitive:flex primitive:w-full primitive:max-w-[95%] primitive:flex-col primitive:gap-2',
      from === 'user' ? 'is-user primitive:ml-auto primitive:justify-end' : 'is-assistant',
      className,
    )}
    {...props}
  />
);
