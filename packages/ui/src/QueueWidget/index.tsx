import { queueActivityDescription } from './helpers.ts';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { Snapshot } from '@pitchcrew/core';
import { ChevronDown, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button/index.tsx';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover/index.tsx';
import { queueSummary } from '@/lib/work-queue.ts';
import { QueueSlots } from './components/QueueSlots.tsx';
import { QueueWidgetQueues } from './components/QueueWidgetQueues.tsx';

export const QueueWidget = ({ data }: { data: Snapshot }) => {
  const [open, setOpen] = useState(false);
  const queue = data.queue;
  if (!queue) return null;
  const { running, ready, held, agents } = queueSummary(queue);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" className="queue-widget-trigger" />}
        aria-label={`Work queue: ${queue.active} of ${queue.concurrency} slots in use, ${ready.length} ready, ${held.length} on hold`}
      >
        <QueueSlots queue={queue} />
        <span>{queue.active ? `${queue.active} working` : 'Queue'}</span>
        {ready.length ? <span className="queue-widget-pending">{ready.length} up next</span> : null}
        {held.length ? <span className="queue-widget-held">{held.length} on hold</span> : null}
        <ChevronDown size={12} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="queue-widget-panel">
        <div className="queue-widget-heading">
          <PopoverTitle>Work queue</PopoverTitle>
          <span>
            {queue.active} / {queue.concurrency} slots
          </span>
        </div>
        <PopoverDescription className="quiet text-xs">
          {queueActivityDescription(agents.length, running.length)}
        </PopoverDescription>
        <QueueSlots queue={queue} />
        {queue.background ? (
          <p className="queue-widget-background">
            {queue.background} background {queue.background === 1 ? 'routine' : 'routines'} running
          </p>
        ) : null}
        <QueueWidgetQueues queue={queue} data={data} close={() => setOpen(false)} />
        {!queue.active && !held.length ? (
          <p className="queue-widget-empty">
            {ready.length
              ? 'Queued work starts when its prerequisites are ready.'
              : 'Your crew is ready for more work.'}
          </p>
        ) : null}
        <Button
          className="w-full"
          variant="outline"
          nativeButton={false}
          render={<Link to="/queue" onClick={() => setOpen(false)} />}
        >
          <ListOrdered size={14} /> Open queue{ready.length ? ` · ${ready.length} up next` : ''}
        </Button>
      </PopoverContent>
    </Popover>
  );
};
