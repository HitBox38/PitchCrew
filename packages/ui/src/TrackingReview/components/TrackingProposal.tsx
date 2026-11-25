import { stateLabels } from '@/lib/labels.ts';
import type { Card } from '@pitchcrew/core';
import { useState } from 'react';
import { FormSelect } from '@/FormSelect/index.tsx';
import { TrackingActions, type TrackingActionsProps } from './TrackingActions.tsx';
import { TrackingEvidence } from './TrackingEvidence.tsx';

type Props = Pick<TrackingActionsProps, 'signal' | 'action' | 'shortcut' | 'armedAt'> & {
  cards: Card[];
  /**
   * Inside a host that names the update, shows its evidence (`TrackingEvidence`) and is already a
   * surface (Home's row): no heading, box or evidence; the application, the verbs, then what
   * approving does under them, in the host's own order.
   */
  headless?: boolean;
};

/**
 * One email's proposed status change: its evidence, the application it applies to, then the verbs.
 */
export const TrackingProposal = ({ signal, cards, headless, ...decision }: Props) => {
  const candidateIds = new Set(signal.candidateIds);
  const candidates = cards.filter(
    (card) => !signal.candidateIds.length || candidateIds.has(card.id),
  );
  const [cardId, setCardId] = useState(
    signal.candidateIds.length === 1 ? signal.candidateIds[0]! : '',
  );
  const selected = candidates.find((card) => card.id === cardId);
  const application = (
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
  );
  const consequence = (
    <p className="quiet">
      Approval links this email thread to the selected application for future updates. Older
      evidence and invalid transitions remain blocked.
    </p>
  );
  const verbs = <TrackingActions signal={signal} selected={selected} {...decision} />;
  if (headless)
    return (
      <div className="form">
        {application}
        {verbs}
        {consequence}
      </div>
    );
  return (
    <article className="form my-3 rounded border border-border p-3">
      <h3>
        {signal.company} · {signal.title} → {stateLabels[signal.state]}
      </h3>
      <TrackingEvidence signal={signal} />
      {application}
      {consequence}
      {verbs}
    </article>
  );
};
