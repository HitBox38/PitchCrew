import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { Card } from '@pitchcrew/core';
import { useState } from 'react';
import { TrackingSource } from '@/TrackingSource/index.tsx';
import { TrackingIdentifier } from './components/TrackingIdentifier.tsx';

export function ApplicationTracking({ card }: { card: Card }) {
  const data = useWorkspaceStore((state) => state.data);
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  const [threadId, setThreadId] = useState('');
  const signals =
    data?.trackingSignals
      ?.filter((signal) => signal.cardId === card.id || signal.candidateIds.includes(card.id))
      .slice(-10) ?? [];
  const connected = data?.connectors.some(
    (connector) =>
      connector.id === 'google' && connector.connected && connector.services.includes('gmail'),
  );
  const path = `/tracking/applications/${card.id}/thread`;
  return (
    <section className="mt-4" aria-label="Application tracking evidence">
      <h3>Tracking evidence</h3>
      <TrackingIdentifier card={card} />
      {card.tracking?.origin === 'external' ? (
        <p>
          Applied outside Pitchcrew on {new Date(card.tracking.submittedAt!).toLocaleString()}.{' '}
          {card.tracking.note}
        </p>
      ) : null}
      {signals.map((signal) => (
        <details className="my-2" key={signal.id}>
          <summary>
            {signal.status} · {signal.state} · {new Date(signal.effectiveAt).toLocaleString()}
          </summary>
          <p>
            {signal.subject} · {signal.from}
          </p>
          <TrackingSource signal={signal} />
          <p className="quiet">
            {signal.reason} Gmail message: {signal.messageId}
          </p>
        </details>
      ))}
      <h4>Linked Gmail threads</h4>
      {(card.tracking?.gmailThreads ?? []).map((link) => (
        <p className="flex items-center gap-2" key={`${link.account}/${link.threadId}`}>
          {link.account} · {link.threadId}
          <Button
            disabled={working}
            onClick={() => act(path, 'DELETE', link, 'Email thread unlinked')}
          >
            Unlink
          </Button>
        </p>
      ))}
      {connected ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label>
            Gmail thread ID
            <Input
              value={threadId}
              maxLength={200}
              onChange={(event) => setThreadId(event.target.value)}
              placeholder="Thread ID from Gmail tools"
            />
          </label>
          <Button
            disabled={working || !/^[a-zA-Z0-9_-]{1,200}$/.test(threadId)}
            onClick={() => act(path, 'POST', { threadId }, 'Email thread linked')}
          >
            Link thread
          </Button>
        </div>
      ) : null}
    </section>
  );
}
