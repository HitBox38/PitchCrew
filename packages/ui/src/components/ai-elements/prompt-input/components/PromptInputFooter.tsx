import type { PromptInputFooterProps } from '@/components/ai-elements/prompt-input/types.ts';
import { InputGroupAddon } from '@/components/ui/input-group/components/InputGroupAddon.tsx';
import { cn } from '@/lib/utils.ts';

export const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn('primitive:justify-between primitive:gap-1', className)}
    {...props}
  />
);
