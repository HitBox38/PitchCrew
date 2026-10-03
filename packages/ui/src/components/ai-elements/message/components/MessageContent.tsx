import type { MessageContentProps } from '@/components/ai-elements/message/types.ts';
import { cn } from '@/lib/utils.ts';

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      'primitive:flex primitive:w-fit primitive:max-w-full primitive:min-w-0 primitive:flex-col primitive:gap-2 primitive:overflow-hidden primitive:text-sm',
      'primitive:group-[.is-user]:ml-auto primitive:group-[.is-user]:rounded-lg primitive:group-[.is-user]:bg-secondary primitive:group-[.is-user]:px-4 primitive:group-[.is-user]:py-3 primitive:group-[.is-user]:text-foreground',
      'primitive:group-[.is-assistant]:text-foreground',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
