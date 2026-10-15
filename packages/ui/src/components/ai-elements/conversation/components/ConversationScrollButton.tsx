import type { ConversationScrollButtonProps } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { MessageScrollerButton } from '@/components/ui/message-scroller/components/MessageScrollerButton.tsx';

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => (
  <MessageScrollerButton
    behavior="instant"
    aria-label="Scroll to latest message"
    className={typeof className === 'string' ? className : undefined}
    render={<Button variant="outline" size="icon" className={className} {...props} />}
  />
);
