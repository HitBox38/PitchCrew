import { useState } from 'react';
import type { WorkspaceQueue } from '@pitchcrew/core';
import { Input } from '@/components/ui/input/index.tsx';
import { Button } from '@/components/ui/button/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const QueueCapacity = ({ queue }: { queue: WorkspaceQueue }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const value = draft ?? String(queue.concurrency);
  const save = async () => {
    try {
      await action('/queue/settings', 'PUT', { concurrency: Number(value) }, 'Concurrency updated');
      setDraft(null);
    } catch {
      /* Workspace error. */
    }
  };
  return (
    <div className="queue-capacity workspace-toolbar">
      <p aria-live="polite">
        <strong>
          {queue.active} of {queue.concurrency}
        </strong>{' '}
        slots in use
        {queue.background
          ? ` · ${queue.background} background ${queue.background === 1 ? 'routine' : 'routines'}`
          : ''}
      </p>
      <div className="flex items-center gap-2">
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
