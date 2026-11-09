import type { Approval, Card, Snapshot } from '@pitchcrew/core';
import type { Decision } from '@/ClayInterface/signals.ts';
import { useJobTimeline } from '../hooks/useJobTimeline.ts';
import { trackDates } from '../helpers.ts';
import { PacketThen } from './PacketThen.tsx';
import { cardPacketStage } from '@/ClayInterface/packet-guidance.ts';
import { currentStageTone } from '@/ClayInterface/helpers.ts';
import { jobAsks } from '@/ClayInterface/signals.ts';
import { executingRuns } from '@/lib/work-queue.ts';

type DecisionRailProps = {
  decision: Decision;
  data: Snapshot;
  card: Card | undefined;
  packet: Approval | undefined;
};

/** What follows this decision, and where its job stands, dated from the job's saved history. */
export const DecisionRail = ({ decision, data, card, packet }: DecisionRailProps) => {
  const stage = card ? cardPacketStage(card, data.approvals) : undefined;
  const steps = useJobTimeline(card, stage);
  const tone = card
    ? currentStageTone(card.state, {
        stage,
        asks: jobAsks(card.id, data),
        live: executingRuns(data.runs).some((run) => run.cardId === card.id),
      })
    : 'current';
  if (!card && !packet) return null;
  const { shared, dates } = trackDates(steps.map((step) => step.at));
  return (
    <aside className="decide-rail" aria-label="What happens next">
      {decision.kind === 'packet' && packet ? <PacketThen approval={packet} data={data} /> : null}
      {card ? (
        <section>
          <h3 className="decide-rail-heading">
            {card.company} so far
            {shared ? <span className="decide-rail-date"> · {shared}</span> : null}
          </h3>
          <ol className="decide-track">
            {steps.map((step, index) => (
              <li key={step.id} data-bead={step.bead}>
                <span
                  className="clay-bead"
                  data-size={step.bead === 'current' ? 'lg' : undefined}
                  data-tone={
                    step.bead === 'done' ? 'done' : step.bead === 'current' ? tone : undefined
                  }
                  data-live={step.bead === 'current' && tone === 'plum' ? '' : undefined}
                  data-empty={step.bead === 'todo' ? '' : undefined}
                  aria-hidden="true"
                />
                <span className="decide-track-label">
                  {step.label}
                  <span className="sr-only">
                    {step.bead === 'done' ? ', done' : step.bead === 'current' ? ', current' : ''}
                  </span>
                </span>
                {step.at && dates[index] ? (
                  <time className="decide-track-date" dateTime={step.at}>
                    {dates[index]}
                  </time>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </aside>
  );
};
