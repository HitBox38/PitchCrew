import type { ChatRequest } from '@pitchcrew/core';
import { QueuedMessageMenu } from './QueuedMessageMenu.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ArrowUp, Pencil, X, Play } from 'lucide-react';
export function QueuedMessageActions({
  request,
  editable,
  working,
  update,
  edit,
}: {
  request: ChatRequest;
  editable: boolean;
  working: boolean;
  update: (command: string) => Promise<unknown>;
  edit: () => void;
}) {
  if (
    !request.deliveries.some((delivery) => ['queued', 'paused', 'failed'].includes(delivery.status))
  )
    return null;
  return (
    <div className="flex gap-1">
      {request.deliveries.some((delivery) => ['paused', 'failed'].includes(delivery.status)) ? (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Resume unfinished deliveries"
          disabled={working}
          onClick={() => void update('resume')}
        >
          <Play size={13} />
        </Button>
      ) : null}
      {editable ? (
        <Button size="icon-xs" variant="ghost" aria-label="Edit queued message" onClick={edit}>
          <Pencil size={13} />
        </Button>
      ) : null}
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Make next"
        disabled={working}
        onClick={() => void update('next')}
      >
        <ArrowUp size={13} />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Cancel pending deliveries"
        disabled={working}
        onClick={() => void update('remove')}
      >
        <X size={13} />
      </Button>
      {request.deliveries.some((delivery) =>
        ['queued', 'paused', 'failed'].includes(delivery.status),
      ) ? (
        <QueuedMessageMenu update={update} working={working} />
      ) : null}
    </div>
  );
}
