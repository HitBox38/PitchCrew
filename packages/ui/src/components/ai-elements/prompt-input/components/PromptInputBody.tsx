import type { PromptInputBodyProps } from '@/components/ai-elements/prompt-input/types.ts';
import { cn } from '@pitchcrew/design-system/utils';

export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
  <div className={cn('primitive:contents', className)} {...props} />
);
