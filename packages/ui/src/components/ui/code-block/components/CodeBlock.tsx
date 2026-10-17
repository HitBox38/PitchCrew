import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import type { VariantProps } from 'class-variance-authority';
import { codeBlockVariants } from '../constants.ts';

export function CodeBlock({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof codeBlockVariants> & { size?: 'default' | 'sm' }) {
  return (
    <div
      data-slot="code-block"
      data-variant={variant}
      data-size={size}
      className={cn(codeBlockVariants({ variant }), className)}
      {...props}
    />
  );
}
