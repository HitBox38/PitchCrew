import { Link } from '@tanstack/react-router';
import { Button } from '@pitchcrew/design-system/button';
import { useDeskRecords } from '../../../hooks/useDeskRecords.ts';
import { releasedQueues } from '../../../records.ts';
import { upNextSegments } from '../helpers.ts';
import { useUpNextOrder } from '../hooks/useUpNextOrder.ts';
import type { HomeLinks, RailModel, UpNextRow as Row } from '../types.ts';
import { UpNextMore } from './UpNextMore.tsx';
import { UpNextRow } from './UpNextRow.tsx';

type UpNextProps = { rail: RailModel; links: HomeLinks };

/**
 * Queues waiting for a slot, in workspace order, each naming its agent and its true place, with
 * Queue's reorder moves. A queue the user released from the desk this session (answered or
 * recovered) stays drawn wherever it rejoined the line; longer stretches fold into one line.
 */
export const UpNext = ({ rail, links }: UpNextProps) => {
  const free = rail.slots ? Math.max(0, rail.slots.concurrency - rail.slots.active) : 0;
  const { line, moves } = useUpNextOrder(rail.upNext, free);
  const { records } = useDeskRecords();
  const index = new Map(line.map((row, place) => [row.id, place]));
  const movesOf = (row: Row) => {
    const place = index.get(row.id);
    return place === undefined ? {} : moves(place);
  };
  return (
    <div className="home-block home-upnext">
      <header className="home-block-head">
        <h2 className="home-heading">
          Up next <span className="home-count">{line.length}</span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link to="/queue" />}
          className="home-link"
        >
          Queue
        </Button>
      </header>
      {line.length ? (
        <ol className="home-rows">
          {upNextSegments(line, releasedQueues(records)).map((segment) =>
            segment.type === 'row' ? (
              <UpNextRow
                key={segment.row.id}
                row={segment.row}
                moves={movesOf(segment.row)}
                links={links}
              />
            ) : (
              <UpNextMore key={segment.key} rows={segment.rows} moves={movesOf} links={links} />
            ),
          )}
        </ol>
      ) : (
        <p className="home-empty">Nothing is waiting for a slot.</p>
      )}
      {rail.heldByYou ? (
        <Link to="/queue" className="home-paused">
          Paused by you · {rail.heldByYou}
        </Link>
      ) : null}
    </div>
  );
};
