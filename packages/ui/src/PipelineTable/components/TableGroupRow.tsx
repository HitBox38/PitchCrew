/** A 12px group label that heads its `<tbody>`, so each row belongs to its group for screen readers. */
export const TableGroupRow = ({ label, columns }: { label: string; columns: number }) => (
  <tr className="pipeline-table-group">
    <th colSpan={columns} scope="rowgroup">
      {label}
    </th>
  </tr>
);
