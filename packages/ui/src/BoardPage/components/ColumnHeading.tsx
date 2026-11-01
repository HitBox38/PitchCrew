import type { BoardSort } from '../sorting.ts';
import { ColumnSortMenu } from './ColumnSortMenu.tsx';

type ColumnHeadingProps = {
  label: string;
  sortLabel?: string;
  count: string;
  beads: { id: string; tone?: string; live: boolean }[];
  sort: BoardSort;
  changeSort: (value: unknown) => void;
  disabled: boolean;
};

/** Name, full count, at most five summary beads and the column's own sort menu. */
export const ColumnHeading = ({
  label,
  sortLabel,
  count,
  beads,
  ...sorting
}: ColumnHeadingProps) => (
  <header className="clay-column-heading">
    <h2 tabIndex={-1} data-stage-heading="">
      {label} <span className="clay-column-count">{count}</span>
    </h2>
    <span className="clay-column-beads" aria-hidden="true">
      {beads.map((bead) => (
        <span
          key={bead.id}
          className="clay-bead"
          data-size="sm"
          data-tone={bead.tone}
          data-live={bead.live ? '' : undefined}
        />
      ))}
    </span>
    <ColumnSortMenu label={sortLabel ?? label} {...sorting} />
  </header>
);
