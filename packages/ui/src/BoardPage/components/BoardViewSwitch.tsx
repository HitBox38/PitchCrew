import { Button } from '@/components/ui/button/components/Button.tsx';
import { groupCount } from '../helpers.ts';
import type { BoardPageModel } from '../types.ts';

type BoardViewSwitchProps = Pick<BoardPageModel, 'showClosed' | 'counts' | 'query'> & {
  select: (stage: string) => void;
};

/** Pipeline | Closed; under search each side counts its matches, so a Closed match is visible. */
export const BoardViewSwitch = ({ showClosed, counts, query, select }: BoardViewSwitchProps) => (
  <fieldset className="view-switch board-segment" aria-label="Board view">
    <Button
      variant="ghost"
      aria-pressed={!showClosed}
      className={!showClosed ? 'active' : ''}
      onClick={() => select('pipeline')}
    >
      Pipeline <span>{groupCount(counts.active.matching, counts.active.total, query)}</span>
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
