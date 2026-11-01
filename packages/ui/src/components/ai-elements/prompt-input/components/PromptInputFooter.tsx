import type { PromptInputFooterProps } from '@/components/ai-elements/prompt-input/types.ts';
import { InputGroupAddon } from '@pitchcrew/design-system/input-group';
import { cn } from '@pitchcrew/design-system/utils';

export const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn('primitive:justify-between primitive:gap-1', className)}
    {...props}
  />
);
