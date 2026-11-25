import { memo } from 'react';
import { Checkbox } from '@pitchcrew/design-system/checkbox';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import { deepEqual } from '@/lib/share-equal.ts';
import type { TableRowModel } from '../types.ts';
import { QueueControl, QueueStoryLine } from './QueueCell.tsx';

type RowProps = {
  row: TableRowModel;
  checked: boolean;
  selecting: boolean;
  toggle: (id: string) => void;
  open: (id: string) => void;
};

/**
 * Line one: company and title. Line two: the Queue story, or the stage and the next step while
 * nothing is queued; a long one wraps at its words instead of being cut. Fit and the item or run
 * control (44px) share a column on the right, so fits line up down the list. The row opens job
 * details anywhere outside the control; in Select mode a tap selects instead, and the checkboxes
 * show.
 */
const Row = ({ row, checked, selecting, toggle, open }: RowProps) => {
  const { card, story } = row;
  return (
    <li className="pipeline-phone-row" data-table-row="" data-checked={checked ? '' : undefined}>
      {selecting ? (
        <Checkbox
          aria-label={`Select ${card.company}`}
          checked={checked}
          onCheckedChange={() => toggle(card.id)}
        />
      ) : null}
      <button
        type="button"
        className="pipeline-phone-open"
        data-table-open={card.id}
        aria-haspopup={selecting ? undefined : 'dialog'}
        aria-pressed={selecting ? checked : undefined}
        onClick={() => (selecting ? toggle(card.id) : open(card.id))}
      >
        <span className="pipeline-phone-line">
          <strong>{card.company}</strong>
          <span className="pipeline-phone-title">{card.title}</span>
          <span className="sr-only">, fit {card.fit ?? 'not scored'},</span>
        </span>
        <span className="pipeline-phone-line">
          {story.kind === 'idle' ? (
            <span className="queue-cell-line">
              <Bead tone={row.stage.tone} />
              <span className="pipeline-phone-rest">
                {row.stage.label}
                {story.text ? <span className="queue-cell-next"> · {story.text}</span> : null}
              </span>
            </span>
          ) : (
            <QueueStoryLine story={story} />
          )}
        </span>
      </button>
      <span className="pipeline-phone-side">
        <span className="pipeline-phone-fit" aria-hidden="true">
          {card.fit ?? <span className="pipeline-table-unscored">Not scored</span>}
        </span>
        {selecting ? null : <QueueControl story={story} />}
      </span>
    </li>
  );
};

/** Rows rebuilt from a new snapshot skip rendering while their job, story and state are unchanged. */
export const PhoneRow = memo(
  Row,
  (prev, next) =>
    prev.checked === next.checked &&
    prev.selecting === next.selecting &&
    prev.toggle === next.toggle &&
    prev.open === next.open &&
    deepEqual(prev.row, next.row),
);
