import { useState } from 'react';
import { TrackingReview } from '@/TrackingReview/index.tsx';
import { ClayBoard } from '@/ClayInterface/components/ClayBoard.tsx';
import { ImportApplications } from '@/ImportApplications/index.tsx';
import { BoardSetup } from '@/Onboarding/index.tsx';
import { useBoardPage } from './hooks/useBoardPage.ts';
import { BoardTitle } from './components/BoardTitle.tsx';
import { BoardEmpty } from './components/BoardEmpty.tsx';
import { BoardStageSelect } from './components/BoardStageSelect.tsx';
import { ClosedPipeline } from './components/ClosedPipeline.tsx';
import { DeleteJobDialog } from './components/DeleteJobDialog.tsx';
import { canDragJob } from './helpers.ts';

export const BoardPage = () => {
  const controller = useBoardPage();
  const [importing, setImporting] = useState(false);
  if (!controller) return null;
  const { data, working, act, openCard, query, showClosed, filtered, stage, jobMutations } =
    controller;
  const setup = data.onboarding?.status === 'setup' ? <BoardSetup /> : null;
  const stageSelect = (
    <BoardStageSelect data={data} current={stage.current} select={stage.select} />
  );
  return (
    <div className="board-workspace">
      <BoardTitle {...controller} importApplications={() => setImporting(true)} />
      <TrackingReview />
      {!data.cards.length ? (
        (setup ?? <BoardEmpty data={data} working={working} act={act} />)
      ) : (
        <>
          {showClosed ? (
            <>
              {stageSelect}
              <ClosedPipeline
                filtered={filtered}
                openCard={openCard}
                query={query}
                jobMutations={jobMutations}
              />
            </>
          ) : (
            <ClayBoard
              data={data}
              filtered={filtered}
              query={query}
              current={stage.current}
              setup={setup}
              stageSelect={stageSelect}
              openCard={openCard}
              jobMutations={jobMutations}
            />
          )}
        </>
      )}
      <ImportApplications open={importing} onClose={() => setImporting(false)} />
      <DeleteJobDialog
        card={jobMutations.deletingCard}
        working={working}
        disabled={
          working || !!(jobMutations.deletingCard && !canDragJob(jobMutations.deletingCard, data))
        }
        close={jobMutations.closeDelete}
        confirm={() => void jobMutations.confirmDelete()}
      />
    </div>
  );
};
