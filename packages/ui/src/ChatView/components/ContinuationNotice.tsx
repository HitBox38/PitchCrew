import type { ChatViewModel } from '../types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { chainFollowUpCount, chainFollowUpLimit } from '@pitchcrew/core/delegation-rounds';
export const ContinuationNotice = ({
  data,
  thread,
  action,
  working,
  running,
  readOnly,
}: ChatViewModel) => {
  if (readOnly) return null;
  const latest = data.chatRequests?.findLast(
    (request) => request.threadId === thread && !request.summarize,
  );
  if (!latest || chainFollowUpCount(data.tasks, latest.id) < chainFollowUpLimit) return null;
  return (
    <div className="chat-continuation">
      <StatusBead status="paused" />
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
};
