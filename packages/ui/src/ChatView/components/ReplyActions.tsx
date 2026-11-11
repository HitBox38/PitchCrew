import type { ChatMessage } from '@pitchcrew/core';
import { Copy } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { copyText } from '@/lib/clipboard.ts';
import { MessageTimestamp } from './MessageTimestamp.tsx';

export const ReplyActions = ({ message }: { message: ChatMessage }) => (
  <div className="chat-reply-actions">
    <Button
      variant="ghost"
      size="sm"
      className="chat-copy-reply"
      onClick={() => copyText(message.content, 'Reply copied')}
      aria-label="Copy reply"
    >
      <Copy size={13} aria-hidden="true" /> Copy
    </Button>
    {/* On the shared clock: a memoized entry would otherwise keep showing "Just now". */}
    <MessageTimestamp createdAt={message.createdAt} />
  </div>
);
