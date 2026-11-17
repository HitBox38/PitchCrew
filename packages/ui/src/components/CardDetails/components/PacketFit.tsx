import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { RefreshCw } from 'lucide-react';
import type { CardDetailsModel } from '../types.ts';
import { jobRole, launchBlocker } from '../helpers.ts';
import { keyedItems } from '@/lib/list-keys.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import { Button } from '@pitchcrew/design-system/button';

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
  const rated = card.packetFit;
  return (
    <section className="detail-packet-fit" aria-label="Packet match to job">
      {/* The rating's meaning travels with its name, as the header's Fit does. */}
      <h3 title="How well this exact packet answers the brief. Separate from your fit; it doesn’t approve the packet.">
        Packet match{' '}
        {rated ? <strong>{rated.score}</strong> : <span className="detail-aside">Not rated</span>}{' '}
        {rated ? (
          <span className="detail-aside">
            Rated {new Date(rated.evaluatedAt).toLocaleDateString()}
          </span>
        ) : null}
      </h3>
      {rated ? (
        <>
          <ul className="feedback">
            {keyedItems(rated.reasons, (reason) => reason).map(({ item, key }) => (
              <li key={key}>{item}</li>
            ))}
          </ul>
          {rated.fitReasons.length ? (
            <AccordionSection heading="Candidate fit reassessment">
              <ul className="feedback">
                {keyedItems(rated.fitReasons, (reason) => reason).map(({ item, key }) => (
                  <li key={key}>{item}</li>
                ))}
              </ul>
            </AccordionSection>
          ) : null}
        </>
      ) : null}
      <div className="detail-inline-actions">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || brief.editing || queued || !!blocker}
          onClick={() =>
            model.act(
              '/queue/actions',
              { cardId: card.id, roleId: role?.id, action: 'reevaluate' },
              'Packet reevaluation queued',
            )
          }
        >
          <RefreshCw size={14} />
          {queued ? 'Reevaluation queued' : 'Reevaluate with packet'}
        </Button>
      </div>
      <p className="detail-run-meta">
        {blocker ||
          (brief.editing
            ? 'Save your brief changes before reevaluating.'
            : role
              ? `${role.name} · ${runtimeLabels[role.runtime]}${role.runtime === 'demo' ? ' · No AI calls' : ' · Your account'}`
              : '')}
      </p>
    </section>
  );
};
