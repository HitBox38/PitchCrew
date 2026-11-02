import { useState } from 'react';
import { CircleAlert, Pause } from 'lucide-react';
import type { Snapshot } from '@pitchcrew/core';
import { Popover, PopoverContent, PopoverTrigger } from '@pitchcrew/design-system/popover';
import { cn } from '@pitchcrew/design-system/utils';
import { queueSummary } from '@/lib/work-queue.ts';
import { queueAttention, queueTrayLabel } from './helpers.ts';
import { QueuePanel } from './components/QueuePanel.tsx';
import { QueueSlots } from './components/QueueSlots.tsx';

/**
 * A compact app-bar queue indicator, with every slot and separate counts for held and failed
 * queues. The phone drawer uses a bounded grid instead of the toolbar's two-row strip.
 */
export const QueueWidget = ({
  data,
  variant = 'bar',
  side,
  align,
  className,
}: {
  data: Snapshot;
  variant?: 'bar' | 'tray';
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const queue = data.queue;
  if (!queue) return null;
  const { ready } = queueSummary(queue);
  const { onHold, failed } = queueAttention(queue);
  const label = queueTrayLabel(queue);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn('queue-tray-button', className)}
        data-variant={variant}
        aria-label={`Work queue: ${queue.active} of ${queue.concurrency} slots in use, ${ready.length} ready, ${onHold} on hold, ${failed} failed`}
        title={label}
      >
        <QueueSlots queue={queue} layout={variant === 'tray' ? 'grid' : 'compact'} />
        <span className="queue-tray-label">
          {queue.active} / {queue.concurrency}
          <span className="sr-only"> slots in use</span>
        </span>
        {onHold ? (
          <span className="queue-tray-attention" data-tone="ochre" title={`${onHold} on hold`}>
            <Pause aria-hidden="true" />
            {onHold}
            <span className="sr-only"> on hold</span>
          </span>
        ) : null}
        {failed ? (
          <span className="queue-tray-attention" data-tone="rose" title={`${failed} failed`}>
            <CircleAlert aria-hidden="true" />
            {failed}
            <span className="sr-only"> failed</span>
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        className="queue-widget-panel"
        side={side ?? (variant === 'bar' ? 'bottom' : 'top')}
        align={align ?? (variant === 'bar' ? 'end' : 'start')}
        sideOffset={8}
      >
        <QueuePanel queue={queue} data={data} close={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
};
