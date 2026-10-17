import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { MessageScroller } from '@/components/ui/message-scroller/components/MessageScroller.tsx';
import { MessageScrollerContent } from '@/components/ui/message-scroller/components/MessageScrollerContent.tsx';

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
