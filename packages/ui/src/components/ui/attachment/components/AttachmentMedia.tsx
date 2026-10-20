import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import type { VariantProps } from 'class-variance-authority';
import { attachmentMediaVariants } from '../constants.ts';

export const AttachmentMedia = ({
  className,
  variant = 'icon',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof attachmentMediaVariants>) => {
  return (
    <div
      data-slot="attachment-media"
      data-variant={variant}
      className={cn(attachmentMediaVariants({ variant }), className)}
      {...props}
    />
  );
};
