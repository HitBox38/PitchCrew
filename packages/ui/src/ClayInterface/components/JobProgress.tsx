import type { Card, Snapshot } from '@pitchcrew/core';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { executingRuns } from '@/lib/work-queue.ts';
import { trackIndex } from '../helpers.ts';
import { decisionTitle } from '../jobs.ts';
import { decisions } from '../signals.ts';
import { StageTrack } from './StageTrack.tsx';

/**
 * Where the job stands and who it waits on, under the job details header; clay preview only.
 * The footer keeps the one action, so this line only says who has the next move.
 */
export const JobProgress = ({ card, data }: { card: Card; data: Snapshot }) => {
  const clay = useDevicePreferences((state) => state.clayInterface);
  if (!clay || trackIndex(card.state) === null) return null;
  const run = executingRuns(data.runs).find((item) => item.cardId === card.id);
  const decision = decisions(data).find((item) => item.cardId === card.id);
  const worker = run ? data.roles.find((role) => role.id === run.roleId) : undefined;
  return (
    <section className="clay-job-progress" aria-label={`${card.company} progress`}>
      <StageTrack
        state={card.state}
        live={!!run}
        tone={decision ? 'ochre' : 'plum'}
        size="md"
        labelled
      />
      {decision ? (
        <p className="clay-job-now" data-asks="">
          <span className="clay-bead" data-size="sm" data-tone="ochre" aria-hidden="true" />
          <span>Waiting on you: {decisionTitle(decision, data)}</span>
        </p>
      ) : run ? (
        <p className="clay-job-now">
          <span className="clay-job-spinner" aria-hidden="true" />
          <span>{worker?.name ?? 'An agent'} is working on this job.</span>
        </p>
      ) : null}
    </section>
  );
};
