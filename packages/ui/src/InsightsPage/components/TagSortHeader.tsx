import type { TagSort } from '@pitchcrew/core/insights';
import { ArrowDown } from 'lucide-react';
import type { ChangeSearch } from '../types.ts';

/** A sortable column heading; the glyph shows only on the active sort. */
export const TagSortHeader = ({
  value,
  label,
  sort,
  change,
  numeric = false,
}: {
  value: TagSort;
  label: string;
  sort: TagSort;
  change: ChangeSearch;
  numeric?: boolean;
}) => {
  const active = sort === value;
  return (
    <th
      scope="col"
      className={numeric ? 'numeric' : undefined}
      aria-sort={active ? (value === 'tag' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        className="insights-sort"
        onClick={() => change({ sort: value === 'count' ? undefined : value })}
      >
        {label}
        {active ? <ArrowDown size={12} aria-hidden="true" /> : null}
      </button>
    </th>
  );
};
