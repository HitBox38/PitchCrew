import { Link } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import type { QueueMoves } from '@/QueuePage/types.ts';
import { upNextSample } from '../constants.ts';
import { restNames } from '../helpers.ts';
import type { HomeLinks, UpNextRow as Row } from '../types.ts';
import { UpNextRow } from './UpNextRow.tsx';

type UpNextMoreProps = {
  rows: Row[];
  /** Each row's moves, by its place in the whole line. */
  moves: (row: Row) => QueueMoves;
  links: HomeLinks;
};

/**
 * A stretch of the waiting line in one line: the exact count and two names at most, so it is
 * never cut inside a name however long the line grows. It opens in place to the next rows, each
 * with Queue's order menu, and says how many more wait in Queue, which stays the long view.
 */
export const UpNextMore = ({ rows, moves, links }: UpNextMoreProps) => {
  const sample = rows.slice(0, upNextSample);
  const remainder = rows.length - sample.length;
  return (
    <li className="home-rest">
      <Collapsible>
        <CollapsibleTrigger className="home-rest-trigger">
          <span className="home-rest-count">{rows.length} more waiting</span>
          <span className="home-rest-names">{restNames(rows)}</span>
          <ChevronDown size={16} className="home-rest-chevron" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent className="home-rest-panel">
          <ol className="home-rows">
            {sample.map((row) => (
              <UpNextRow key={row.id} row={row} moves={moves(row)} links={links} />
            ))}
          </ol>
          {remainder ? (
            <Link to="/queue" className="home-rest-queue">
              {remainder} more in Queue
            </Link>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
};
