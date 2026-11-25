import type { Snapshot } from '@pitchcrew/core';
import {
  WorkspaceHeaderActions,
  WorkspaceHeaderPrimary,
  WorkspaceHeaderSegment,
} from '@/App/components/WorkspacePage.tsx';
import type { BoardPageModel } from '../types.ts';
import type { PipelineMode } from '../hooks/usePipelineMode.ts';
import { AddJobMenu } from './AddJobMenu.tsx';
import { BoardSearch } from './BoardSearch.tsx';
import { BoardViewSwitch } from './BoardViewSwitch.tsx';
import { JumpToMenu } from './JumpToMenu.tsx';
import { PipelineModeSwitch } from './PipelineModeSwitch.tsx';

type BoardTitleProps = Pick<
  BoardPageModel,
  'showClosed' | 'counts' | 'query' | 'setQuery' | 'stage' | 'setAdd'
> & {
  data: Snapshot;
  mode: PipelineMode;
  chooseMode: (mode: PipelineMode) => void;
  importApplications: () => void;
};

/**
 * Pipeline's title-row controls: Open | Closed and Board | Table side by side, scoped job search,
 * stage jumps (the board's columns only) and Add job.
 */
export const BoardTitle = ({
  data,
  mode,
  chooseMode,
  importApplications,
  ...props
}: BoardTitleProps) => (
  <>
    {data.cards.length ? (
      <WorkspaceHeaderSegment>
        <BoardViewSwitch
          showClosed={props.showClosed}
          counts={props.counts}
          query={props.query}
          select={props.stage.select}
        />
        <PipelineModeSwitch mode={mode} choose={chooseMode} />
      </WorkspaceHeaderSegment>
    ) : null}
    <WorkspaceHeaderActions>
      {data.cards.length ? (
        <>
          <BoardSearch query={props.query} setQuery={props.setQuery} />
          {mode === 'board' ? <JumpToMenu cards={data.cards} jump={props.stage.jump} /> : null}
        </>
      ) : null}
    </WorkspaceHeaderActions>
    <WorkspaceHeaderPrimary>
      <AddJobMenu add={() => props.setAdd(true)} importApplications={importApplications} />
    </WorkspaceHeaderPrimary>
  </>
);
