import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { MessageScroller, MessageScrollerContent } from '@pitchcrew/design-system/message-scroller';

export type ConversationProps = ComponentProps<typeof MessageScroller> & {
  autoScroll?: boolean;
  defaultScrollPosition?: 'start' | 'end' | 'last-anchor';
};
export type ConversationContentProps = ComponentProps<typeof MessageScrollerContent> & {
  scrollClassName?: string;
};
export type ConversationEmptyStateProps = ComponentProps<'div'> & {
  title?: string;
  description?: string;
  icon?: ReactNode;
};
export type ConversationScrollButtonProps = ComponentProps<typeof Button>;
