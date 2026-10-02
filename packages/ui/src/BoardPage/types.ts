import type { useBoardPage } from '@/BoardPage/hooks/useBoardPage.ts';

export type BoardPageModel = NonNullable<ReturnType<typeof useBoardPage>>;

export type BoardToolbarProps = Pick<
  BoardPageModel,
  'showClosed' | 'setShowClosed' | 'data' | 'active' | 'query' | 'setQuery'
>;

export type BoardWelcomeProps = Pick<BoardPageModel, 'setAdd' | 'working' | 'act'>;

export type ClosedJobsProps = Pick<BoardPageModel, 'closed' | 'openCard'>;

export type JobPipelineProps = Pick<
  BoardPageModel,
  'filtered' | 'flashStage' | 'setAdd' | 'openCard' | 'query'
>;

export type RecentActivityProps = Pick<BoardPageModel, 'go' | 'recent'>;
