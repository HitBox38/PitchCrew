import type { ChatProgressProps } from '@/ChatView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { LoaderCircle } from 'lucide-react';

export function ChatProgress({ running, name, working, action }: ChatProgressProps) {
  return (
    <output className="chat-progress">
      <LoaderCircle size={15} className="spin" />
      <span>{running.map((r) => `${name(r.roleId)}: ${r.message}`).join(' · ')}</span>
      <Button
        className="text-button"
        disabled={working}
        onClick={() => {
          void (async () => {
            for (const run of running) await action(`/runs/${run.id}/cancel`).catch(() => {});
          })();
        }}
      >
        Stop
      </Button>
    </output>
  );
}
