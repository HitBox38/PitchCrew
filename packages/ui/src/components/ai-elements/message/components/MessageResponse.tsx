import type { MessageResponseProps } from '@/components/ai-elements/message/types.ts';
import { cn } from '@/lib/utils.ts';
import { memo } from 'react';
import { MarkdownContent } from '@/components/MarkdownContent/index.tsx';

export const MessageResponse = memo(({ className, ...props }: MessageResponseProps) => (
  <MarkdownContent className={cn('primitive:w-full', className)} {...props} />
));
