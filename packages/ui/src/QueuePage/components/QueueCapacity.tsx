import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WorkspaceQueue } from '@pitchcrew/core';
import { Input } from '@pitchcrew/design-system/input';
import { Button } from '@pitchcrew/design-system/button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from '@pitchcrew/design-system/popover';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { slotFact } from '../helpers.ts';

export const QueueCapacity = ({ queue }: { queue: WorkspaceQueue }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const value = draft ?? String(queue.concurrency);
  const save = async () => {
    try {
      await action('/queue/settings', 'PUT', { concurrency: Number(value) }, 'Concurrency updated');
      setDraft(null);
      setOpen(false);
    } catch {
      /* Workspace error. */
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="sm" className="queue-capacity-trigger" />}
        aria-label={`Capacity settings, ${queue.active} of ${queue.concurrency} slots in use`}
      >
        <span>{slotFact(queue.active, queue.concurrency)}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="queue-capacity-popup">
        <PopoverTitle className="queue-capacity-title">Capacity settings</PopoverTitle>
        <PopoverDescription className="queue-capacity-note">
          Each job or conversation uses one slot. Agents within a job can work together.
        </PopoverDescription>
        <div className="queue-capacity-controls">
          <label htmlFor="queue-concurrency">Concurrent work</label>
          <Input
            id="queue-concurrency"
            className="w-20"
            type="number"
            min={1}
            max={50}
            value={value}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        {queue.active > queue.concurrency ? (
          <p className="queue-capacity-note">Running work will finish before new work starts.</p>
        ) : null}
        <Button
          className="w-full"
          disabled={
            working ||
            !Number.isInteger(Number(value)) ||
            Number(value) < 1 ||
            Number(value) > 50 ||
            Number(value) === queue.concurrency
          }
          onClick={() => void save()}
        >
          Save limit
        </Button>
      </PopoverContent>
    </Popover>
  );
};
