import type { ApplicationImportReport } from '@pitchcrew/core';
import { importStatusLabels } from '../constants.ts';
import { importTones } from '../helpers.ts';

/** Plain counts per outcome; the preview never imports rows that are not new. */
export const ImportCounts = ({
  report,
  applied,
}: {
  report: ApplicationImportReport;
  applied: boolean;
}) => (
  <section className="import-counts" aria-live="polite" aria-label={applied ? 'Result' : 'Review'}>
    <span className="import-counts-total">
      {report.rows.length} {report.rows.length === 1 ? 'row' : 'rows'}
    </span>
    {(Object.keys(importStatusLabels) as (keyof typeof importStatusLabels)[])
      .filter((status) => report.counts[status])
      .map((status) => (
        <span key={status} className="ui-chip" data-tone={importTones[status]}>
          {report.counts[status]} {importStatusLabels[status].toLowerCase()}
        </span>
      ))}
    <span className="import-counts-note">
      {applied
        ? 'Skipped rows were left out.'
        : 'Only new rows are imported. Importing this file again skips them.'}
    </span>
  </section>
);
