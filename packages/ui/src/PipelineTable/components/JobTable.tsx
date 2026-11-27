import { Link } from '@tanstack/react-router';
import { groupLabels } from '../constants.ts';
import { emptyLine, viewDef } from '../helpers.ts';
import type { TableModel } from '../hooks/usePipelineTable.ts';
import { PhoneRows } from './PhoneRows.tsx';
import { TableGroupRow } from './TableGroupRow.tsx';
import { TableHead } from './TableHead.tsx';
import { TableRow } from './TableRow.tsx';

type Props = { model: TableModel; phone: boolean; open: (id: string) => void };

/**
 * The rows themselves: a real table (one `<tbody>` per group, the open button in each row's
 * header cell), or the phone's two-line list. Needs you's caption counts the jobs that wait on the
 * user and links Home for the items this view does not list.
 */
export const JobTable = ({ model, phone, open }: Props) => {
  const columns = model.columns.length + (model.selectable ? 1 : 0);
  const queue = model.columns.some(([id]) => id === 'queue');
  const picked = new Set(model.selected);
  const total = model.view ? model.counts[model.view].total : model.rows.length;
  const empty = model.visible.length ? null : (
    <p className="ui-empty pipeline-table-empty">{emptyLine(model.view, total, model.query)}</p>
  );
  const caption = model.caption ? (
    <>
      {model.caption.text}
      {model.caption.more ? (
        <>
          {' · '}
          <Link to="/">{model.caption.more} more on Home</Link>
        </>
      ) : null}
    </>
  ) : null;
  if (phone)
    return (
      <>
        {caption ? <p className="pipeline-table-caption">{caption}</p> : null}
        {empty ?? <PhoneRows model={model} open={open} />}
      </>
    );
  return (
    <table
      className="pipeline-table"
      aria-label={model.view ? `Open jobs: ${viewDef(model.view).label}` : 'Closed jobs'}
      data-closed={model.closed ? '' : undefined}
    >
      {caption ? <caption className="pipeline-table-caption">{caption}</caption> : null}
      <TableHead
        columns={model.columns}
        selection={model.selection}
        selectable={model.selectable}
        togglePage={model.togglePage}
      />
      {empty ? (
        <tbody>
          <tr>
            <td colSpan={columns} className="pipeline-table-empty-cell">
              {empty}
            </td>
          </tr>
        </tbody>
      ) : (
        model.groups.map((group) => (
          <tbody key={group.id ?? 'rows'}>
            {group.id ? <TableGroupRow label={groupLabels[group.id]} columns={columns} /> : null}
            {group.rows.map((row) => (
              <TableRow
                key={row.card.id}
                row={row}
                checked={picked.has(row.card.id)}
                selectable={model.selectable}
                queue={queue}
                toggle={model.toggle}
                open={open}
              />
            ))}
          </tbody>
        ))
      )}
    </table>
  );
};
