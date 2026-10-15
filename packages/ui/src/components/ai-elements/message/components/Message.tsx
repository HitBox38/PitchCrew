import type { MessageProps } from '../types.ts';
import { MessageRoleContext } from '../context.ts';
import { Message as MessageRoot } from '@/components/ui/message/components/Message.tsx';
import { cn } from '@/lib/utils.ts';

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
