import { useState } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover/index.tsx';
import { cn } from '@/lib/utils';
import { queueSummary } from '@/lib/work-queue.ts';
import { queueTrayLabel } from './helpers.ts';
import { QueuePanel } from './components/QueuePanel.tsx';
import { QueueSlots } from './components/QueueSlots.tsx';

/**
 * The sidebar slot tray's Queue button and the popover it opens. `tray` shows the sockets and
 * "2 of 5 working"; `rail` shows the sockets alone, with the same words as its accessible name.
 */
export const QueueWidget = ({
  data,
  variant = 'tray',
  side,
  align,
  className,
}: {
  data: Snapshot;
  variant?: 'tray' | 'rail';
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const queue = data.queue;
  if (!queue) return null;
  const { ready, held } = queueSummary(queue);
  const label = queueTrayLabel(queue);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn('queue-tray-button', className)}
        data-variant={variant}
        aria-label={`Work queue: ${queue.active} of ${queue.concurrency} slots in use, ${ready.length} ready, ${held.length} on hold`}
        title={variant === 'rail' ? label : undefined}
      >
        <QueueSlots queue={queue} />
        {variant === 'tray' ? (
          <span className="queue-tray-label">
            {label.split(' · ').map((part, index, parts) => (
              <span key={part}>
                <span className="whitespace-nowrap">
                  {part}
                  {index < parts.length - 1 ? ' ·' : ''}
                </span>{' '}
              </span>
            ))}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        className="queue-widget-panel"
        side={side ?? (variant === 'rail' ? 'right' : 'top')}
        align={align ?? (variant === 'rail' ? 'end' : 'start')}
        sideOffset={8}
      >
        <QueuePanel queue={queue} data={data} close={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
};
