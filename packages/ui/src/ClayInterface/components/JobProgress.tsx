import type { Card, Snapshot } from '@pitchcrew/core';
import { executingRuns } from '@/lib/work-queue.ts';
import { trackIndex } from '../helpers.ts';
import { decisions } from '../signals.ts';
import { NextUp } from './NextUp.tsx';
import { StageTrack } from './StageTrack.tsx';

/**
 * Where the job stands and who it waits on, under the job details header.
 * The footer keeps the one action, so this line only says who has the next move.
 */
export const JobProgress = ({ card, data }: { card: Card; data: Snapshot }) => {
  if (trackIndex(card.state) === null) return null;
  const live = executingRuns(data.runs).some((item) => item.cardId === card.id);
  const asks = decisions(data).some((item) => item.cardId === card.id);
  return (
    <section className="clay-job-progress" aria-label={`${card.company} progress`}>
      <StageTrack
        state={card.state}
        live={live}
        tone={asks ? 'ochre' : undefined}
        size="md"
        labelled
      />
      <NextUp card={card} data={data} />
    </section>
  );
};
