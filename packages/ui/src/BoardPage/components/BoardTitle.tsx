import type { Snapshot } from '@pitchcrew/core';
import {
  WorkspaceHeaderActions,
  WorkspaceHeaderPrimary,
  WorkspaceHeaderSegment,
} from '@/App/components/WorkspacePage.tsx';
import type { BoardPageModel } from '../types.ts';
import { AddJobMenu } from './AddJobMenu.tsx';
import { BoardSearch } from './BoardSearch.tsx';
import { BoardViewSwitch } from './BoardViewSwitch.tsx';
import { JumpToMenu } from './JumpToMenu.tsx';

type BoardTitleProps = Pick<
  BoardPageModel,
  'showClosed' | 'counts' | 'query' | 'setQuery' | 'stage' | 'setAdd'
> & { data: Snapshot; importApplications: () => void };

/** Board's title-row controls: view, scoped job search, stage jumps and Add job. */
export const BoardTitle = ({ data, importApplications, ...props }: BoardTitleProps) => (
  <>
    {data.cards.length ? (
      <WorkspaceHeaderSegment>
        <BoardViewSwitch
          showClosed={props.showClosed}
          counts={props.counts}
          query={props.query}
          select={props.stage.select}
        />
      </WorkspaceHeaderSegment>
    ) : null}
    <WorkspaceHeaderActions>
      {data.cards.length ? (
        <>
          <BoardSearch query={props.query} setQuery={props.setQuery} />
          <JumpToMenu cards={data.cards} jump={props.stage.jump} />
        </>
      ) : null}
    </WorkspaceHeaderActions>
    <WorkspaceHeaderPrimary>
      <AddJobMenu add={() => props.setAdd(true)} importApplications={importApplications} />
    </WorkspaceHeaderPrimary>
  </>
);
