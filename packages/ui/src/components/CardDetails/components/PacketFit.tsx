import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { RefreshCw } from 'lucide-react';
import type { CardDetailsModel } from '../types.ts';
import { jobRole, launchBlocker } from '../helpers.ts';
import { keyedItems } from '@/lib/list-keys.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export const PacketFit = ({ model }: { model: CardDetailsModel }) => {
  const { card, data, busy, brief } = model;
  const role = jobRole(data, 'scout');
  const queued = (data.queue?.queues ?? [])
    .filter((queue) => queue.cardId === card.id)
    .flatMap((queue) => queue.requests)
    .some((request) => request.boardAction === 'reevaluate');
  const blocker = !card.packet
    ? 'Draft a packet to rate its match to this job.'
    : !brief.loaded?.context || brief.loaded.context.sourceRevision !== brief.loaded.sourceRevision
      ? 'Prepare the current job brief before reevaluating.'
      : launchBlocker(data, role?.id);
  return (
    <section className="space-y-3" aria-label="Packet match to job">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3>Packet match to job</h3>
        {card.packetFit ? <strong>{card.packetFit.score}/100</strong> : <span>Not rated</span>}
      </div>
      <p className="quiet">
        How well the complete packet addresses this job. This rating is separate from candidate fit
        and does not approve the packet.
      </p>
      {card.packetFit ? (
        <>
          <ul className="feedback">
            {keyedItems(card.packetFit.reasons, (reason) => reason).map(({ item, key }) => (
              <li key={key}>{item}</li>
            ))}
          </ul>
          {card.packetFit.fitReasons.length ? (
            <AccordionSection heading="Candidate fit reassessment">
              <ul className="feedback">
                {keyedItems(card.packetFit.fitReasons, (reason) => reason).map(({ item, key }) => (
                  <li key={key}>{item}</li>
                ))}
              </ul>
            </AccordionSection>
          ) : null}
          <p className="quiet">Evaluated {new Date(card.packetFit.evaluatedAt).toLocaleString()}</p>
        </>
      ) : null}
      <Button
        variant="outline"
        disabled={busy || brief.editing || queued || !!blocker}
        onClick={() =>
          model.act(
            '/queue/actions',
            {
              cardId: card.id,
              roleId: role?.id,
              action: 'reevaluate',
            },
            'Packet reevaluation queued',
          )
        }
      >
        <RefreshCw size={15} />
        {queued ? 'Reevaluation queued' : 'Reevaluate with packet'}
      </Button>
      <p className="quiet">
        {blocker ||
          (brief.editing
            ? 'Save your brief changes before reevaluating.'
            : role
              ? `${role.name} · ${runtimeLabels[role.runtime]}${role.runtime === 'demo' ? ' · No AI calls' : ' · Uses your CLI account'}`
              : '')}
      </p>
    </section>
  );
};
