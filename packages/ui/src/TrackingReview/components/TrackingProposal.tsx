import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { stateLabels } from '@/lib/labels.ts';
import type { Card, TrackingSignal } from '@pitchcrew/core';
import { useState } from 'react';
import { TrackingSource } from '@/TrackingSource/index.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';

export function TrackingProposal({ signal, cards }: { signal: TrackingSignal; cards: Card[] }) {
  const candidates = cards.filter(
    (card) => !signal.candidateIds.length || signal.candidateIds.includes(card.id),
  );
  const [cardId, setCardId] = useState(
    signal.candidateIds.length === 1 ? signal.candidateIds[0]! : '',
  );
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  const selected = candidates.find((card) => card.id === cardId);
  const path = `/tracking/evidence/${signal.id}`;
  return (
    <article className="form my-3 rounded border border-border p-3">
      <h3>
        {signal.company} · {signal.title} → {stateLabels[signal.state]}
      </h3>
      <p className="quiet">
        {signal.from} · {signal.subject} · {new Date(signal.effectiveAt).toLocaleString()}
      </p>
      <TrackingSource signal={signal} />
      <p>{signal.reason}</p>
      <FormSelect
        className="my-2"
        label="Application"
        value={cardId}
        onValueChange={setCardId}
        options={[
          { value: '', label: 'Choose an application' },
          ...candidates.map((card) => ({
            value: card.id,
            label: `${card.company} · ${card.title} · ${stateLabels[card.state]} · ${card.tracking?.jobIdentifier || card.url || card.id}`,
          })),
        ]}
      />
      <p className="quiet">
        Approval links this email thread to the selected application for future updates. Older
        evidence and invalid transitions remain blocked.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          className="button primary"
          disabled={working || !selected}
          onClick={() =>
            act(
              `${path}/decision`,
              'POST',
              { approved: true, cardId, cardUpdatedAt: selected?.updatedAt },
              'Tracking update applied',
            )
          }
        >
          Apply update
        </Button>
        <Button
          className="button"
          disabled={working}
          onClick={() =>
            act(`${path}/decision`, 'POST', { approved: false }, 'Tracking update rejected')
          }
        >
          Reject
        </Button>
        <Button
          className="button"
          disabled={working}
          onClick={() => act(`${path}/refresh`, 'POST', {}, 'Application comparison refreshed')}
        >
          Refresh comparison
        </Button>
      </div>
    </article>
  );
}
