import type { ConversationScrollButtonProps } from '@/components/ai-elements/conversation/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { cn } from '@/lib/utils.ts';
import { ArrowDownIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useStickToBottomContext } from 'use-stick-to-bottom';

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn(
          'absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full dark:bg-background dark:hover:bg-muted',
          className,
        )}
        onClick={handleScrollToBottom}
        aria-label="Scroll to latest message"
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};
