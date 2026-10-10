import type { ChatViewModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
export function ContinuationNotice({
  data,
  thread,
  action,
  working,
  running,
  readOnly,
}: ChatViewModel) {
  if (readOnly) return null;
  const latest = data.chatRequests?.findLast(
    (request) => request.threadId === thread && !request.summarize,
  );
  const count = data.tasks.filter((task) => task.rootRunId === latest?.id).length;
  if (count < 6) return null;
  return (
    <div className="chat-continuation">
      <span>
        This round reached six automatic follow-ups. Continue summarizes the work before starting
        another round.
      </span>
      <Button
        size="sm"
        disabled={working || !!running.length}
        onClick={() => void action(`/conversations/${thread}/continue`).catch(() => {})}
      >
        Continue
      </Button>
    </div>
  );
}
