import type { MessageProps } from '../types.ts';
import { MessageRoleContext } from '../context.ts';
import { Message as MessageRoot } from '@pitchcrew/design-system/message';
import { cn } from '@pitchcrew/design-system/utils';

export const Message = ({ className, from, ...props }: MessageProps) => (
  <MessageRoleContext value={from}>
    <MessageRoot
      align={from === 'user' ? 'end' : 'start'}
      className={cn(
        'flex-col data-[align=end]:flex-col',
        from === 'user' ? 'is-user ml-auto' : 'is-assistant',
        className,
      )}
      {...props}
    />
  </MessageRoleContext>
);
