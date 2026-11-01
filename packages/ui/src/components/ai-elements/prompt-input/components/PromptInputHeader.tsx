import type { PromptInputHeaderProps } from '@/components/ai-elements/prompt-input/types.ts';
import { InputGroupAddon } from '@pitchcrew/design-system/input-group';
import { cn } from '@pitchcrew/design-system/utils';

export const PromptInputHeader = ({ className, ...props }: PromptInputHeaderProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn('primitive:order-first primitive:flex-wrap primitive:gap-1', className)}
    {...props}
  />
);
