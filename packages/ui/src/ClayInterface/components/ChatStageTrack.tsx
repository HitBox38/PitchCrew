import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { executingRuns } from '@/lib/work-queue.ts';
import { trackIndex } from '../helpers.ts';
import { decisions } from '../signals.ts';
import { StageTrack } from './StageTrack.tsx';

/** Where the conversation's job stands, under the chat header; clay preview only. */
export const ChatStageTrack = ({ thread }: { thread: string }) => {
  const clay = useDevicePreferences((state) => state.clayInterface);
  const data = useWorkspaceStore((state) => state.data);
  const cardId = data?.conversations?.find((item) => item.id === thread)?.cardId;
  const card = cardId ? data?.cards.find((item) => item.id === cardId) : undefined;
  if (!clay || !data || !card || trackIndex(card.state) === null) return null;
  const live = executingRuns(data.runs).some((run) => run.cardId === card.id);
  const asks = decisions(data).some((decision) => decision.cardId === card.id);
  return (
    <div className="clay-chat-stage" aria-label={`${card.company} progress`}>
      <StageTrack
        state={card.state}
        live={live}
        tone={asks ? 'ochre' : 'plum'}
        size="md"
        labelled
      />
    </div>
  );
};
