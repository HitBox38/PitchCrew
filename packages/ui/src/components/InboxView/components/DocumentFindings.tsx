import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { keyedItems } from '@/lib/list-keys.ts';
import type { Approval } from '@pitchcrew/core';
import {
  fileNotes,
  isWordLayoutCaveat,
  notesLabel,
  wordLayoutNotice,
} from '@/lib/document-findings.ts';
/** The packet's file check: per-file notes, with the shared Word layout notice stated once. */
export const DocumentFindings = ({ approval }: { approval: Approval }) => {
  const reports = approval.documentVerification ?? [];
  if (!reports.length) return null;
  const blocked = reports.filter((report) => report.status === 'blocked').length;
  const findings = reports.flatMap((report) => fileNotes(report.findings) ?? []);
  const word = reports.some((report) => report.findings.some(isWordLayoutCaveat));
  return (
    <AccordionSection
      className="packet-findings"
      heading={`${reports.filter((report) => report.status === 'verified').length} documents checked${blocked ? ` · ${blocked} unavailable` : ''}${findings.length ? ` · ${notesLabel(findings)}` : ''}`}
    >
      {reports.map((report) => (
        <div key={report.name} className="mb-3">
          <p className="font-semibold">
            {report.name}:{' '}
            {report.status === 'blocked' ? 'Unavailable for export' : 'Content checked'}
          </p>
          {keyedItems(fileNotes(report.findings) ?? [], (finding) => JSON.stringify(finding)).map(
            ({ item: finding, key }) => (
              <p
                className={finding.severity === 'error' ? 'text-destructive' : 'text-ink-soft'}
                key={key}
              >
                <span className="sr-only">
                  {finding.severity === 'error' ? 'Error: ' : 'Warning: '}
                </span>
                {finding.page ? `Page ${finding.page}: ` : ''}
                {finding.message}
              </p>
            ),
          )}
        </div>
      ))}
      {word ? <p className="quiet">{wordLayoutNotice}</p> : null}
      <p className="quiet">
        Checks assess content and layout. They do not establish ATS compatibility or factual
        accuracy.
      </p>
    </AccordionSection>
  );
};
