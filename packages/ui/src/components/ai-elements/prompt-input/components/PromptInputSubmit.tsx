import type { PromptInputSubmitProps } from '@/components/ai-elements/prompt-input/types.ts';
import { InputGroupButton } from '@pitchcrew/design-system/input-group';

export const PromptInputSubmit = ({
  variant = 'default',
  size = 'icon-sm',
  ...props
}: PromptInputSubmitProps) => (
  <InputGroupButton aria-label="Submit" size={size} type="submit" variant={variant} {...props} />
);
