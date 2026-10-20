import { useState } from 'react';
import type { WorkspaceQueue } from '@pitchcrew/core';
import { Input } from '@/components/ui/input/index.tsx';
import { Button } from '@/components/ui/button/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { QueueSlots } from '@/QueueWidget/components/QueueSlots.tsx';
import { queueSummary } from '@/lib/work-queue.ts';

export const QueueCapacity = ({ queue }: { queue: WorkspaceQueue }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const value = draft ?? String(queue.concurrency);
  const { available } = queueSummary(queue);
  const save = async () => {
    try {
      await action('/queue/settings', 'PUT', { concurrency: Number(value) }, 'Concurrency updated');
      setDraft(null);
    } catch {
      /* Workspace error. */
    }
  };
  return (
    <div className="queue-capacity">
      <div className="queue-capacity-overview">
        <div className="queue-capacity-label">
          <h2>Parallel work</h2>
          <p aria-live="polite">
            <strong>
              {queue.active} of {queue.concurrency}
            </strong>{' '}
            slots in use
          </p>
        </div>
        <QueueSlots queue={queue} />
        <p className="queue-capacity-note">
          {queue.active > queue.concurrency
            ? 'Running work will finish before new work starts.'
            : `${available} ${available === 1 ? 'slot' : 'slots'} available.`}{' '}
          Each active job or conversation uses one slot.
          {queue.background
            ? ` Includes ${queue.background} background ${queue.background === 1 ? 'routine' : 'routines'}.`
            : ''}
        </p>
      </div>
      <div className="queue-capacity-controls">
        <label htmlFor="queue-concurrency">Concurrent work</label>
        <Input
          id="queue-concurrency"
          className="w-20"
          type="number"
          min={1}
          max={50}
          value={value}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          disabled={
            working ||
            !Number.isInteger(Number(value)) ||
            Number(value) < 1 ||
            Number(value) > 50 ||
            Number(value) === queue.concurrency
          }
          onClick={() => void save()}
        >
          Save
        </Button>
      </div>
    </div>
  );
};
