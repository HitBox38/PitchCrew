import type { ChatViewModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { MessagesSquare } from 'lucide-react';
export function RelatedConversations({ data, thread, onThread }: ChatViewModel) {
  const related = (data.conversations ?? []).filter((item) => item.parentId === thread);
  if (!related.length) return null;
  return (
    <div className="chat-related">
      <MessagesSquare size={13} />
      <span>Related work</span>
      {related.map((item) => (
        <Button key={item.id} variant="ghost" size="xs" onClick={() => onThread(item.id)}>
          {item.title}
        </Button>
      ))}
    </div>
  );
}
