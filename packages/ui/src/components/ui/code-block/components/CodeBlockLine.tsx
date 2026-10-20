import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import type { VariantProps } from 'class-variance-authority';
import { codeBlockLineVariants } from '../constants.ts';

export const CodeBlockLine = ({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof codeBlockLineVariants>) => {
  // An empty line holds a newline so copying a selection keeps blank lines.
  const empty =
    children === undefined ||
    children === null ||
    children === '' ||
    (Array.isArray(children) && children.length === 0);

  return (
    <span
      data-slot="code-block-line"
      data-variant={variant}
      className={cn(codeBlockLineVariants({ variant }), className)}
      {...props}
    >
      <span data-slot="code-block-line-content" className="primitive:min-w-0">
        {empty ? '\n' : children}
      </span>
    </span>
  );
};
