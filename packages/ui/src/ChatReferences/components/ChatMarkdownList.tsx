import { Children, isValidElement, type ComponentProps, type CSSProperties } from 'react';
import type { ExtraProps } from 'streamdown';
import { cn } from '@pitchcrew/design-system/utils';

/** Own list markers rather than inheriting Streamdown's unlayered list-inside utility. */
export const ChatMarkdownList = ({
  node: _node,
  className,
  ...props
}: ComponentProps<'ul'> & ExtraProps) => (
  <ul {...props} className={cn('chat-markdown-list', className)} />
);

export const ChatMarkdownOrderedList = ({
  node: _node,
  className,
  children,
  start = 1,
  style,
  ...props
}: ComponentProps<'ol'> & ExtraProps) => {
  const count = Children.toArray(children).filter(isValidElement).length;
  const last = start + Math.max(0, count - 1);
  const digits = Math.max(2, String(Math.abs(start)).length, String(Math.abs(last)).length);
  return (
    <ol
      {...props}
      start={start}
      className={cn('chat-markdown-list', className)}
      style={{ ...style, '--chat-list-digits': digits } as CSSProperties}
    >
      {children}
    </ol>
  );
};
