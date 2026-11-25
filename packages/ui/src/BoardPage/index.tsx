import { useState } from 'react';
import { ClayBoard } from '@/ClayInterface/components/ClayBoard.tsx';
import { ImportApplications } from '@/ImportApplications/index.tsx';
import { PipelineTable } from '@/PipelineTable/index.tsx';
import { useRootFlag } from '@/lib/use-root-flag.ts';
import { useBoardPage } from './hooks/useBoardPage.ts';
import { usePipelineMode } from './hooks/usePipelineMode.ts';
import { BoardTitle } from './components/BoardTitle.tsx';
import { BoardEmpty } from './components/BoardEmpty.tsx';
import { BoardStageSelect } from './components/BoardStageSelect.tsx';
import { ClosedPipeline } from './components/ClosedPipeline.tsx';
import { DeleteJobDialog } from './components/DeleteJobDialog.tsx';
import { canDragJob } from './helpers.ts';

/** Pipeline: the board's columns or the table, over open or closed jobs. */
export const BoardPage = () => {
  const controller = useBoardPage();
  const pipeline = usePipelineMode();
  const [importing, setImporting] = useState(false);
  // Pipeline's title row ends a wrapped Add job on the right (styles/board.css).
  useRootFlag('pipeline', true);
  if (!controller) return null;
  const { data, working, act, openCard, query, showClosed, filtered, stage, jobMutations } =
    controller;
  const stageSelect = (
    <BoardStageSelect data={data} current={stage.current} select={stage.select} />
  );
  return (
    <div className="board-workspace">
      <BoardTitle
        {...controller}
        mode={pipeline.mode}
        chooseMode={pipeline.choose}
        importApplications={() => setImporting(true)}
      />
      {!data.cards.length ? (
        <BoardEmpty data={data} working={working} act={act} />
      ) : pipeline.mode === 'table' ? (
        <PipelineTable
          data={data}
          query={query}
          closed={showClosed}
          view={pipeline.view}
          chooseView={pipeline.chooseView}
          openCard={openCard}
        />
      ) : showClosed ? (
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
          filtered={filtered}
          query={query}
          current={stage.current}
          stageSelect={stageSelect}
          openCard={openCard}
          jobMutations={jobMutations}
        />
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
