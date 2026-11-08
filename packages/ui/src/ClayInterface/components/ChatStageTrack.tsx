import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { executingRuns } from '@/lib/work-queue.ts';
import { currentStageTone, stepLabel, trackIndex } from '../helpers.ts';
import { cardPacketStage } from '../packet-guidance.ts';
import { jobAsks } from '../signals.ts';
import { NextUp } from './NextUp.tsx';
import { StageTrack } from './StageTrack.tsx';

/** Where the conversation's job stands, under the chat header. */
export const ChatStageTrack = ({ thread }: { thread: string }) => {
  const data = useWorkspaceStore((state) => state.data);
  const cardId = data?.conversations?.find((item) => item.id === thread)?.cardId;
  const card = cardId ? data?.cards.find((item) => item.id === cardId) : undefined;
  if (!data || !card || trackIndex(card.state) === null) return null;
  const live = executingRuns(data.runs).some((run) => run.cardId === card.id);
  const asks = jobAsks(card.id, data);
  const stage = cardPacketStage(card, data.approvals);
  const tone = currentStageTone(card.state, { asks, live, stage });
  return (
    <section className="clay-chat-stage" aria-label={`${card.company} progress`}>
      <span className="clay-chat-current">
        <span
          className="clay-bead"
          data-size="sm"
          data-tone={tone}
          data-live={tone === 'plum' ? '' : undefined}
          aria-hidden="true"
        />
        {stepLabel(card.state, trackIndex(card.state) ?? 0, stage)}
      </span>
      <StageTrack
        state={card.state}
        live={live}
        tone={asks ? 'ochre' : undefined}
        size="md"
        labelled
        stage={stage}
      />
      <NextUp card={card} data={data} />
    </section>
  );
};
