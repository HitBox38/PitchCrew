import * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import type { VariantProps } from 'class-variance-authority';
import { codeBlockVariants } from '../constants.ts';
import { codeBlockPresence } from '../presence.ts';

export const CodeBlock = ({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof codeBlockVariants> & { size?: 'default' | 'sm' }) => {
  const { Provider, register, attributes } = codeBlockPresence.useRoot();
  return (
    <Provider value={register}>
      <div
        data-slot="code-block"
        data-variant={variant}
        data-size={size}
        {...attributes}
        className={cn(codeBlockVariants({ variant }), className)}
        {...props}
      />
    </Provider>
  );
};
