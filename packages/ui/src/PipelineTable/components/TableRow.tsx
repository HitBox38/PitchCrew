import { memo } from 'react';
import { Checkbox } from '@pitchcrew/design-system/checkbox';
import { deepEqual } from '@/lib/share-equal.ts';
import type { TableRowModel } from '../types.ts';
import { QueueCell } from './QueueCell.tsx';
import { StageCell } from './StageCell.tsx';

type Props = {
  row: TableRowModel;
  checked: boolean;
  selectable: boolean;
  /** Whether the page shows the Queue column (the Closed view may drop it). */
  queue: boolean;
  toggle: (id: string) => void;
  open: (id: string) => void;
};

/**
 * One job. The company button is the row's one stop: Enter opens job details, and its hit area
 * covers the row; the checkbox and the Queue cell's control sit above it. On narrower trays the
 * stage moves under the title (a copy for the eye only; the Stage cell keeps it for screen
 * readers), and on the narrowest the row becomes two lines.
 */
const Row = ({ row, checked, selectable, queue, toggle, open }: Props) => {
  const { card } = row;
  return (
    <tr className="pipeline-table-row" data-table-row="" data-checked={checked ? '' : undefined}>
      {selectable ? (
        <td data-col="check">
          <Checkbox
            aria-label={`Select ${card.company}`}
            checked={checked}
            onCheckedChange={() => toggle(card.id)}
          />
        </td>
      ) : null}
      <th scope="row" data-col="company" title={card.company}>
        <button
          type="button"
          className="pipeline-table-open"
          data-table-open={card.id}
          aria-haspopup="dialog"
          aria-label={`${card.company}, ${card.title}`}
          onClick={() => open(card.id)}
        >
          {card.company}
        </button>
      </th>
      <td data-col="title" title={card.title}>
        <span className="pipeline-table-title">{card.title}</span>
        <span className="pipeline-table-title-stage" aria-hidden="true">
          {row.stage.label}
        </span>
      </td>
      <td data-col="stage">
        <StageCell stage={row.stage} />
      </td>
      <td data-col="fit">
        {card.fit ?? <span className="pipeline-table-unscored">Not scored</span>}
      </td>
      {queue ? (
        <td data-col="queue">
          <QueueCell story={row.story} />
        </td>
      ) : null}
      <td data-col="updated">
        <time dateTime={card.updatedAt}>{row.updated}</time>
      </td>
    </tr>
  );
};

/** Rows rebuilt from a new snapshot skip rendering while their job and story are unchanged. */
export const TableRow = memo(
  Row,
  (prev, next) =>
    prev.checked === next.checked &&
    prev.selectable === next.selectable &&
    prev.queue === next.queue &&
    prev.toggle === next.toggle &&
    prev.open === next.open &&
    deepEqual(prev.row, next.row),
);
