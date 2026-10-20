import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { Card } from '@pitchcrew/core';
import { useApplicationTracking } from './hooks/useApplicationTracking.ts';
import { TrackingSource } from '@/TrackingSource/index.tsx';
import { TrackingIdentifier } from './components/TrackingIdentifier.tsx';

export function ApplicationTracking({
  card,
  onDirtyChange,
}: {
  card: Card;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { working, threadId, setThreadId, setIdentifierDirty, signals, connected, unlink, link } =
    useApplicationTracking(card, onDirtyChange);
  return (
    <section className="form mt-4" aria-label="Application tracking evidence">
      <h3>Tracking evidence</h3>
      <TrackingIdentifier card={card} onDirtyChange={setIdentifierDirty} />
      {card.tracking?.origin === 'external' ? (
        <p className="prewrap">
          Applied outside Pitchcrew on {new Date(card.tracking.submittedAt!).toLocaleString()}.{' '}
          {card.tracking.note}
        </p>
      ) : card.tracking?.note ? (
        <p className="prewrap">{card.tracking.note}</p>
      ) : null}
      {signals.map((signal) => (
        <AccordionSection
          className="my-2"
          key={signal.id}
          heading={
            <>
              {signal.status} · {signal.state} · {new Date(signal.effectiveAt).toLocaleString()}
            </>
          }
        >
          <p>
            {signal.subject} · {signal.from}
          </p>
          <TrackingSource signal={signal} />
          <p className="quiet">
            {signal.reason} Gmail message: {signal.messageId}
          </p>
        </AccordionSection>
      ))}
      <h4>Linked Gmail threads</h4>
      {(card.tracking?.gmailThreads ?? []).map((link) => (
        <p className="flex flex-wrap items-center gap-2" key={`${link.account}/${link.threadId}`}>
          {link.account} · {link.threadId}
          <Button
            className="text-button danger min-h-8"
            variant="ghost"
            disabled={working}
            onClick={() => unlink(link)}
          >
            Unlink
          </Button>
        </p>
      ))}
      {connected ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 basis-48">
            Gmail thread ID
            <Input
              value={threadId}
              maxLength={200}
              onChange={(event) => setThreadId(event.target.value)}
              placeholder="Thread ID from Gmail tools"
            />
          </label>
          <Button disabled={working || !/^[a-zA-Z0-9_-]{1,200}$/.test(threadId)} onClick={link}>
            Link thread
          </Button>
        </div>
      ) : null}
    </section>
  );
}
