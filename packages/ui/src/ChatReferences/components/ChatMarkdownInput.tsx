import type { ComponentProps } from 'react';
import type { ExtraProps } from 'streamdown';
import { Checkbox } from '@pitchcrew/design-system/checkbox';
import { cn } from '@pitchcrew/design-system/utils';

/** Markdown tasks report a saved state; they are not editable form controls. */
export const ChatMarkdownInput = ({ type, checked }: ComponentProps<'input'>) =>
  type === 'checkbox' ? (
    <Checkbox
      checked={!!checked}
      disabled
      aria-label={checked ? 'Completed item' : 'Incomplete item'}
      style={{ display: 'inline-flex', verticalAlign: 'text-bottom', marginInlineEnd: '0.35em' }}
    />
  ) : null;

export const ChatMarkdownListItem = ({
  node: _node,
  className,
  style,
  ...props
}: ComponentProps<'li'> & ExtraProps) => (
  <li
    {...props}
    className={cn('chat-markdown-list-item [&>p]:m-0 [&>p+p]:mt-2', className)}
    style={
      className?.split(/\s+/).includes('task-list-item')
        ? { ...style, listStyleType: 'none' }
        : style
    }
  />
);
