import { InputGroupAddon, InputGroupButton } from '@pitchcrew/design-system/input-group';
import type { ComponentProps, FormEvent, HTMLAttributes } from 'react';

export type PromptInputProps = Omit<HTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
  onSubmit: (message: { text: string }, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export type PromptInputHeaderProps = Omit<ComponentProps<typeof InputGroupAddon>, 'align'>;

export type PromptInputFooterProps = Omit<ComponentProps<typeof InputGroupAddon>, 'align'>;

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton>;
