import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ComponentProps } from 'react';
import { StickToBottom } from 'use-stick-to-bottom';

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export type ConversationEmptyStateProps = ComponentProps<'div'> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;
