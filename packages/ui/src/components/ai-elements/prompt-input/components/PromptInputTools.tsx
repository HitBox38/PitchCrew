import type { PromptInputToolsProps } from '@/components/ai-elements/prompt-input/types.ts';
import { cn } from '@/lib/utils.ts';

export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => (
  <div className={cn('flex min-w-0 items-center gap-1', className)} {...props} />
);
