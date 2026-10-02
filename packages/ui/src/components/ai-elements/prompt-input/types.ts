import { InputGroupAddon } from '@/components/ui/input-group/components/InputGroupAddon.tsx';
import { InputGroupButton } from '@/components/ui/input-group/components/InputGroupButton.tsx';
import { InputGroupTextarea } from '@/components/ui/input-group/components/InputGroupTextarea.tsx';
import type { ChatStatus, FileUIPart } from 'ai';
import type { ComponentProps, FormEvent, HTMLAttributes } from 'react';

export interface PromptInputMessage {
  text: string;
  files: FileUIPart[];
}

export type PromptInputProps = Omit<HTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>;

export type PromptInputHeaderProps = Omit<ComponentProps<typeof InputGroupAddon>, 'align'>;

export type PromptInputFooterProps = Omit<ComponentProps<typeof InputGroupAddon>, 'align'>;

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  onStop?: () => void;
};
