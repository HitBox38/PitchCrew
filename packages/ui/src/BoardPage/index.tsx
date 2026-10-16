import { BoardToolbar } from '@/BoardPage/components/BoardToolbar.tsx';
import { BoardWelcome } from '@/BoardPage/components/BoardWelcome.tsx';
import { JobPipeline } from '@/BoardPage/components/JobPipeline.tsx';
import { RecentActivity } from '@/BoardPage/components/RecentActivity.tsx';
import { useBoardPage } from '@/BoardPage/hooks/useBoardPage.ts';
import { LayoutGroup } from 'motion/react';
import { TrackingReview } from '@/TrackingReview/index.tsx';
import { DeleteJobDialog } from './components/DeleteJobDialog.tsx';
import { canDragJob } from './helpers.ts';

export function BoardPage() {
  const controller = useBoardPage();
  if (!controller) return null;
  const {
    data,
    working,
    act,
    openCard,
    setAdd,
    query,
    setQuery,
    showClosed,
    setShowClosed,
    flashStage,
    go,
    active,
    filtered,
    recent,
    jobMutations,
  } = controller;
  return (
    <div className="board-workspace flex min-h-0 flex-1 flex-col gap-3">
      <TrackingReview />
      {!data.cards.length ? (
        data.onboarding?.status !== 'setup' ? (
          <BoardWelcome data={data} setAdd={setAdd} working={working} act={act} />
        ) : null
      ) : (
        <>
          <BoardToolbar
            showClosed={showClosed}
            setShowClosed={setShowClosed}
            data={data}
            active={active}
            query={query}
            setQuery={setQuery}
          />
          <LayoutGroup id="board-jobs">
            <JobPipeline
              showClosed={showClosed}
              filtered={filtered}
              flashStage={flashStage}
              setAdd={setAdd}
              openCard={openCard}
              query={query}
              jobMutations={jobMutations}
            />
          </LayoutGroup>
          {recent.length ? <RecentActivity go={go} recent={recent} /> : null}
        </>
      )}
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
}
