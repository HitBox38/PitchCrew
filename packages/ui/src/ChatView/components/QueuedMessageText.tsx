import { useLayoutEffect, useRef, useState } from 'react';
import type { ChatRequest } from '@pitchcrew/core';
import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@pitchcrew/design-system/collapsible';
import { SavedQueueAttachments } from './SavedQueueAttachments.tsx';
import { beginQueuedTextReveal } from '../queue-scroll.ts';

export const QueuedMessageText = ({ request, text }: { request: ChatRequest; text: string }) => {
  const [open, setOpen] = useState(false);
  const reading = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    if (reading.current) return beginQueuedTextReveal(reading.current);
  }, [open]);
  return (
    <Collapsible
      ref={reading}
      open={open}
      onOpenChange={setOpen}
      className="chat-queued-reading"
      data-message-open={open || undefined}
    >
      <CollapsibleTrigger className="chat-queued-preview" title={text}>
        <ChevronRight size={13} aria-hidden="true" />
        <span>{open ? 'Hide message' : text.replace(/\s+/g, ' ').trim()}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="chat-queued-full-text">{text}</div>
        <SavedQueueAttachments files={request.attachments} />
      </CollapsibleContent>
      {!open && request.attachments.length ? (
        <small className="chat-queued-file-count">
          {request.attachments.length} saved{' '}
          {request.attachments.length === 1 ? 'attachment' : 'attachments'}
        </small>
      ) : null}
    </Collapsible>
  );
};
