import type { JobReveal } from './hooks/useJobPage.ts';
import type { useBoardPage } from '@/BoardPage/hooks/useBoardPage.ts';
import type { JobMenuActions } from './components/JobActionsMenu/types.ts';

export type BoardPageModel = NonNullable<ReturnType<typeof useBoardPage>>;

export type BoardEmptyProps = Pick<BoardPageModel, 'working' | 'act' | 'data'>;

export type ClosedJobsProps = Pick<BoardPageModel, 'openCard' | 'data' | 'working'> & {
  closed: BoardPageModel['filtered'];
  total: number;
  dragging: boolean;
  query: string;
  reveal: JobReveal;
  menuActions: JobMenuActions;
};

export type ClosedPipelineProps = Pick<
  BoardPageModel,
  'filtered' | 'openCard' | 'query' | 'jobMutations'
>;
