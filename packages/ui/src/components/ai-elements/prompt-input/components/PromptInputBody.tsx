import type { PromptInputBodyProps } from '@/components/ai-elements/prompt-input/types.ts';
import { cn } from '@/lib/utils.ts';

export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
  <div className={cn('contents', className)} {...props} />
);
