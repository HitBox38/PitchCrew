import type { Card, Snapshot } from '@pitchcrew/core';
import { executingRuns } from '@/lib/work-queue.ts';
import { packetNeedsReview } from '@/lib/job-step.ts';
import { stateLabels } from '@/lib/labels.ts';
import { stepLabel, trackIndex, trackSteps } from '../helpers.ts';
import { cardPacketStage } from '../packet-guidance.ts';
import { jobAsks } from '../signals.ts';
import { StageTrack } from './StageTrack.tsx';

/**
 * Where the job stands, in the job details header: a compact bead track and the current step's
 * name. The bead colour says who has the move; the dock below says what it is, so this row never
 * repeats it. Hovering names all six steps; screen readers hear "Stage N of 6".
 */
export const JobProgress = ({ card, data }: { card: Card; data: Snapshot }) => {
  const index = trackIndex(card.state);
  // A closed job is not failed work: an empty socket and its name, where the track would be.
  if (index === null)
    return (
      <section className="clay-job-progress" aria-label={`${card.company} progress`}>
        <span className="detail-closed" data-state={card.state}>
          <span className="clay-bead" data-size="sm" data-empty="" aria-hidden="true" />
          {stateLabels[card.state]}
        </span>
      </section>
    );
  const live = executingRuns(data.runs).some((item) => item.cardId === card.id);
  const asks = jobAsks(card.id, data);
  const stage = cardPacketStage(card, data.approvals);
  // An agreed or approved packet whose review went stale is reviewed again, as the dock says.
  const stale =
    (card.state === 'agreed' || card.state === 'awaiting_approval') && packetNeedsReview(card);
  const steps = trackSteps.map((_, step) => stepLabel(card.state, step, stage)).join(' → ');
  return (
    <section className="clay-job-progress" aria-label={`${card.company} progress`} title={steps}>
      <StageTrack
        state={card.state}
        live={live}
        tone={asks ? 'ochre' : undefined}
        size="sm"
        stage={stage}
      />
      <span className="clay-job-stage" aria-hidden="true">
        {stale ? 'Review again' : stepLabel(card.state, index, stage)}
      </span>
    </section>
  );
};
