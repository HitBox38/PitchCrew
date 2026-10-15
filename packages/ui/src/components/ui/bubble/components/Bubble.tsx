import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import type { VariantProps } from 'class-variance-authority';
import { bubbleVariants } from '../constants.ts';

export function Bubble({
  variant = 'default',
  align = 'start',
  className,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof bubbleVariants> & {
    align?: 'start' | 'end';
  }) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  );
}
