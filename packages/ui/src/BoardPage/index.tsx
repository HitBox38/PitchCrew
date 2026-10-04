import { BoardToolbar } from '@/BoardPage/components/BoardToolbar.tsx';
import { BoardWelcome } from '@/BoardPage/components/BoardWelcome.tsx';
import { ClosedJobs } from '@/BoardPage/components/ClosedJobs.tsx';
import { JobPipeline } from '@/BoardPage/components/JobPipeline.tsx';
import { RecentActivity } from '@/BoardPage/components/RecentActivity.tsx';
import { useBoardPage } from '@/BoardPage/hooks/useBoardPage.ts';
import { LayoutGroup } from 'motion/react';
import { TrackingReview } from '@/TrackingReview/index.tsx';

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
    closed,
    recent,
  } = controller;
  return (
    <>
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
          {showClosed ? (
            <LayoutGroup id="closed-jobs">
              <ClosedJobs closed={closed} openCard={openCard} />
            </LayoutGroup>
          ) : (
            <LayoutGroup id="pipeline-jobs">
              <JobPipeline
                filtered={filtered}
                flashStage={flashStage}
                setAdd={setAdd}
                openCard={openCard}
                query={query}
              />
            </LayoutGroup>
          )}
          {recent.length ? <RecentActivity go={go} recent={recent} /> : null}
        </>
      )}
    </>
  );
}
