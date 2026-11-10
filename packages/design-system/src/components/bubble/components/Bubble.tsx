import * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import type { VariantProps } from 'class-variance-authority';
import { bubbleVariants } from '../constants.ts';
import { messagePresence } from '../../message/presence.ts';

export const Bubble = ({
  variant = 'default',
  align = 'start',
  className,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof bubbleVariants> & {
    align?: 'start' | 'end';
  }) => {
  // Inside a message, a ghost bubble lets the message's header and footer drop their inset.
  messagePresence.usePresent('ghost', variant === 'ghost');
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  );
};
