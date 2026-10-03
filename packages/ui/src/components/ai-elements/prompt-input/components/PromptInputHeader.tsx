import type { PromptInputHeaderProps } from '@/components/ai-elements/prompt-input/types.ts';
import { InputGroupAddon } from '@/components/ui/input-group/components/InputGroupAddon.tsx';
import { cn } from '@/lib/utils.ts';

export const PromptInputHeader = ({ className, ...props }: PromptInputHeaderProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn('primitive:order-first primitive:flex-wrap primitive:gap-1', className)}
    {...props}
  />
);
