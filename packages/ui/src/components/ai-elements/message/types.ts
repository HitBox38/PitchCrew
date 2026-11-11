import type { ComponentProps, HTMLAttributes } from 'react';
import { Streamdown } from 'streamdown';

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: 'user' | 'assistant' | 'system';
};

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export type MessageResponseProps = ComponentProps<typeof Streamdown>;
