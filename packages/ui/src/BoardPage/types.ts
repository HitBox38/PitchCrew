import type { JobReveal } from './hooks/useJobPage.ts';
import type { useBoardPage } from '@/BoardPage/hooks/useBoardPage.ts';
import type { JobMenuActions } from './components/JobActionsMenu/types.ts';

export type BoardPageModel = NonNullable<ReturnType<typeof useBoardPage>>;

export type BoardToolbarProps = Pick<
  BoardPageModel,
  'showClosed' | 'setShowClosed' | 'data' | 'active' | 'query' | 'setQuery'
>;

export type BoardWelcomeProps = Pick<BoardPageModel, 'setAdd' | 'working' | 'act' | 'data'>;

export type ClosedJobsProps = Pick<BoardPageModel, 'closed' | 'openCard' | 'data' | 'working'> & {
  dragging: boolean;
  query: string;
  reveal: JobReveal;
  menuActions: JobMenuActions;
};

export type JobPipelineProps = Pick<
  BoardPageModel,
  'filtered' | 'flashStage' | 'setAdd' | 'openCard' | 'query' | 'showClosed' | 'jobMutations'
>;

export type RecentActivityProps = Pick<BoardPageModel, 'go' | 'recent'>;
