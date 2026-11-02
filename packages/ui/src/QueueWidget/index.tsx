import { useState } from 'react';
import { CircleAlert, Pause } from 'lucide-react';
import type { Snapshot } from '@pitchcrew/core';
import { Popover, PopoverContent, PopoverTrigger } from '@pitchcrew/design-system/popover';
import { cn } from '@pitchcrew/design-system/utils';
import { queueSummary } from '@/lib/work-queue.ts';
import { queueAttention, queueCountLabel, queueTrayLabel } from './helpers.ts';
import { QueuePanel } from './components/QueuePanel.tsx';
import { QueueCapacityMeter } from './components/QueueCapacityMeter.tsx';

/**
 * A capacity-independent summary: one state bead, aggregate occupancy and active/limit counts.
 * Exact counts and bounded work details live in the popover, for desktop and phones alike.
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
        <span
          className="clay-bead"
          data-size="sm"
          data-tone={queue.active ? 'plum' : undefined}
          data-empty={queue.active ? undefined : ''}
          aria-hidden="true"
        />
        <span className="queue-tray-summary">
          <span className="queue-tray-label">
            {queueCountLabel(queue.active)} / {queueCountLabel(queue.concurrency)}
            <span className="sr-only"> slots in use</span>
          </span>
          <QueueCapacityMeter queue={queue} />
        </span>
        {onHold ? (
          <span className="queue-tray-attention" data-tone="ochre" title={`${onHold} on hold`}>
            <Pause aria-hidden="true" />
            {onHold > 99 ? '99+' : onHold}
            <span className="sr-only"> on hold</span>
          </span>
        ) : null}
        {failed ? (
          <span className="queue-tray-attention" data-tone="rose" title={`${failed} failed`}>
            <CircleAlert aria-hidden="true" />
            {failed > 99 ? '99+' : failed}
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
