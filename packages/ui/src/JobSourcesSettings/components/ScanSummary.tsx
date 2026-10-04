import type { JobScanSummary } from '@pitchcrew/core';
import { Link } from '@tanstack/react-router';
import { scanSummaryText } from '../helpers.ts';

export function ScanSummary({ summary }: { summary: JobScanSummary }) {
  const failed = summary.sources.filter((source) => source.status === 'failed');
  return (
    <output className="job-source-summary mt-4 block" aria-live="polite">
      <p>
        {scanSummaryText(summary)}{' '}
        {summary.new ? <Link to="/">Open the board to review new leads.</Link> : null}
      </p>
      {failed.length ? (
        <ul className="quiet mt-2 grid gap-1">
          {failed.map((source) => (
            <li key={source.sourceId}>
              {source.name}: {source.error}
            </li>
          ))}
        </ul>
      ) : null}
    </output>
  );
}
