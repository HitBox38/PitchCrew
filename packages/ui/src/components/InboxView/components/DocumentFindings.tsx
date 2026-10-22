import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { keyedItems } from '@/lib/list-keys.ts';
import type { Approval } from '@pitchcrew/core';
export const DocumentFindings = ({ approval }: { approval: Approval }) => {
  const reports = approval.documentVerification ?? [];
  if (!reports.length) return null;
  const blocked = reports.filter((report) => report.status === 'blocked').length;
  const findings = reports.flatMap((report) => report.findings);
  return (
    <AccordionSection
      className="mail-document-findings"
      heading={`${reports.filter((report) => report.status === 'verified').length} documents checked${blocked ? ` · ${blocked} unavailable` : ''}${findings.length ? ` · ${findings.length} layout notes` : ''}`}
    >
      {reports.map((report) => (
        <div key={report.name} className="mb-3">
          <p className="font-semibold">
            {report.name}:{' '}
            {report.status === 'blocked' ? 'Unavailable for export' : 'Content checked'}
          </p>
          {keyedItems(report.findings, (finding) => JSON.stringify(finding)).map(
            ({ item: finding, key }) => (
              <p
                className={finding.severity === 'error' ? 'text-destructive' : 'text-ochre'}
                key={key}
              >
                {finding.page ? `Page ${finding.page}: ` : ''}
                {finding.message}
              </p>
            ),
          )}
        </div>
      ))}
      <p className="quiet">
        Checks assess content and layout. They do not establish ATS compatibility or factual
        accuracy.
      </p>
    </AccordionSection>
  );
};
