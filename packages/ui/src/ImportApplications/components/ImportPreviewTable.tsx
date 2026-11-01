import type { ApplicationImportReport } from '@pitchcrew/core';
import { ImportRow } from './ImportRow.tsx';

/** The review table; below 640px each row becomes an identity line plus a labelled detail block. */
export const ImportPreviewTable = ({ report }: { report: ApplicationImportReport }) => (
  <section className="import-table-wrap" aria-label="Import preview rows">
    <table className="import-table">
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
          <ImportRow key={row.row} row={row} />
        ))}
      </tbody>
    </table>
  </section>
);
