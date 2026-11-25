import { Button } from '@pitchcrew/design-system/button';
import { groupCount } from '../helpers.ts';
import type { BoardPageModel } from '../types.ts';

type BoardViewSwitchProps = Pick<BoardPageModel, 'showClosed' | 'counts' | 'query'> & {
  select: (stage: string) => void;
};

/** Open | Closed; under search each side counts its matches, so a Closed match is visible. */
export const BoardViewSwitch = ({ showClosed, counts, query, select }: BoardViewSwitchProps) => (
  <fieldset className="view-switch board-segment" aria-label="Open or closed jobs">
    <Button
      variant="ghost"
      aria-pressed={!showClosed}
      className={!showClosed ? 'active' : ''}
      onClick={() => select('pipeline')}
    >
      Open <span>{groupCount(counts.active.matching, counts.active.total, query)}</span>
    </Button>
    <Button
      variant="ghost"
      aria-pressed={showClosed}
      className={showClosed ? 'active' : ''}
      onClick={() => select('closed')}
    >
      Closed <span>{groupCount(counts.closed.matching, counts.closed.total, query)}</span>
    </Button>
  </fieldset>
);
