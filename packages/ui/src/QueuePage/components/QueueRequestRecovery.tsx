import { Button } from '@/components/ui/button/index.tsx';
import type { useQueueRequest } from '../hooks/useQueueRequest.ts';

/** Retry or skip a paused/failed request, aligned under its text. */
export const QueueRequestRecovery = ({ model }: { model: ReturnType<typeof useQueueRequest> }) =>
  model.pending && model.failed && !model.editing ? (
    <div className="queue-request-recovery">
      <Button
        variant="outline"
        size="sm"
        disabled={model.working}
        onClick={() => model.command('resume')}
      >
        Retry
      </Button>
      <Button variant="ghost" size="sm" disabled={model.working} onClick={() => void model.skip()}>
        Skip and continue
      </Button>
    </div>
  ) : null;
