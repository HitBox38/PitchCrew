import { groupLabels } from '../constants.ts';
import type { TableModel } from '../hooks/usePipelineTable.ts';
import { PhoneRow } from './PhoneRow.tsx';

/** The phone's list: the same rows, groups and order as the table, as two-line items. */
export const PhoneRows = ({ model, open }: { model: TableModel; open: (id: string) => void }) => {
  const picked = new Set(model.selected);
  const selecting = model.selectable && model.selecting;
  return (
    <div className="pipeline-phone-list">
      {model.groups.map((group) => (
        <div key={group.id ?? 'rows'} className="pipeline-phone-group">
          {group.id ? (
            <h2 className="pipeline-phone-group-label">{groupLabels[group.id]}</h2>
          ) : null}
          <ul>
            {group.rows.map((row) => (
              <PhoneRow
                key={row.card.id}
                row={row}
                checked={picked.has(row.card.id)}
                selecting={selecting}
                toggle={model.toggle}
                open={open}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
