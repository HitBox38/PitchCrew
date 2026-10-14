import { Streamdown, type StreamdownProps } from 'streamdown';
import { cn } from '@/lib/utils.ts';

/** Shared document presentation; chat callers opt into streaming while a turn is active. */
export function MarkdownContent({ className, ...props }: StreamdownProps) {
  return (
    <Streamdown
      mode="static"
      className={cn('markdown-content max-w-full min-w-0', className)}
      {...props}
    />
  );
}
