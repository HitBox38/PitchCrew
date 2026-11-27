import { Checkbox } from '@pitchcrew/design-system/checkbox';
import type { TableColumn } from '../constants.ts';
import type { SelectionFacts } from '../types.ts';

/**
 * The sticky, sentence-case header. Its checkbox covers the current page (mixed while part of it is
 * selected); the selection itself spans pages.
 */
export const TableHead = ({
  columns,
  selection,
  selectable,
  togglePage,
}: {
  columns: readonly TableColumn[];
  selection: SelectionFacts;
  selectable: boolean;
  togglePage: () => void;
}) => (
  <thead>
    <tr>
      {selectable ? (
        <th scope="col" data-col="check">
          <Checkbox
            aria-label="Select every job on this page"
            checked={selection.all}
            indeterminate={selection.some && !selection.all}
            onCheckedChange={togglePage}
          />
        </th>
      ) : null}
      {columns.map(([id, label]) => (
        <th key={id} scope="col" data-col={id}>
          {label}
        </th>
      ))}
    </tr>
  </thead>
);
