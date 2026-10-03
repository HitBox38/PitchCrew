import type { PromptInputToolsProps } from '@/components/ai-elements/prompt-input/types.ts';
import { cn } from '@/lib/utils.ts';

export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => (
  <div
    className={cn(
      'primitive:flex primitive:min-w-0 primitive:items-center primitive:gap-1',
      className,
    )}
    {...props}
  />
);
