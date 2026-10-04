import type { ApplicationImportReport } from '@pitchcrew/core';
import { stateLabels } from '@/lib/labels.ts';
import { importStatusLabels } from '../constants.ts';
import { importPath } from '../helpers.ts';

export function ImportPreviewTable({ report }: { report: ApplicationImportReport }) {
  return (
    <div className="mt-3 max-h-[55vh] overflow-auto rounded-md border border-border">
      <table className="import-table w-full border-collapse text-label">
        <thead>
          <tr>
            <th scope="col">Row</th>
            <th scope="col">Application</th>
            <th scope="col">Status</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.row} data-status={row.status}>
              <td>{row.row}</td>
              <td>
                <strong>{row.company || 'Missing company'}</strong>
                <span className="block">{row.title || 'Untitled role'}</span>
              </td>
              <td>
                {row.state ? stateLabels[row.state] : row.sourceState || 'Unknown'}
                {row.path.length > 1 ? (
                  <span className="quiet block">{importPath(row.path)}</span>
                ) : null}
              </td>
              <td>
                <strong>{importStatusLabels[row.status]}</strong>
                {row.reason ? <span className="block">{row.reason}</span> : null}
                {row.warnings.map((warning) => (
                  <span className="quiet block" key={warning}>
                    {warning}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
