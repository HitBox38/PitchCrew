import type { ApplicationImportReport } from '@pitchcrew/core';
import { importCounts } from '../helpers.ts';

export function ImportSummary({
  report,
  applied,
}: {
  report: ApplicationImportReport;
  applied: boolean;
}) {
  return (
    <section className="mt-4" aria-live="polite">
      <h3>{applied ? 'Import result' : 'Preview'}</h3>
      <p className="quiet">
        {report.rows.length} rows: {importCounts(report)}
      </p>
      {!applied ? (
        <p className="quiet">
          Only new rows are imported. Duplicates and invalid rows are skipped. Importing the same
          file again skips rows that were already imported.
        </p>
      ) : null}
    </section>
  );
}
