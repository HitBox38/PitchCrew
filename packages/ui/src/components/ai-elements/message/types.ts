import type { UIMessage } from 'ai';
import type { ComponentProps, HTMLAttributes } from 'react';
import { Streamdown } from 'streamdown';

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage['role'];
};

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export type MessageActionsProps = ComponentProps<'div'>;

export type MessageResponseProps = ComponentProps<typeof Streamdown>;
