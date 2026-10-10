import type { ChatProgressProps } from '@/ChatView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { LoaderCircle } from 'lucide-react';

export function ChatProgress({ running, name, working, action, thread }: ChatProgressProps) {
  return (
    <output className="chat-progress">
      <LoaderCircle size={15} className="spin" />
      <span>{running.map((r) => `${name(r.roleId)}: ${r.message}`).join(' · ')}</span>
      {running.map((run) => (
        <Button
          key={run.id}
          className="text-button"
          disabled={working}
          onClick={() =>
            void action(`/conversations/${thread}/stop`, 'POST', { roleId: run.roleId }).catch(
              () => {},
            )
          }
        >
          Stop {name(run.roleId)}
        </Button>
      ))}
    </output>
  );
}
