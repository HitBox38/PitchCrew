import type { ConversationScrollButtonProps } from '../types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { MessageScrollerButton } from '@pitchcrew/design-system/message-scroller';

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
