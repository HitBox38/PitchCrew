import type { Approval } from '@pitchcrew/core';

export const DocumentFindings = ({ approval }: { approval: Approval }) => {
  if (!approval.documentVerification?.length) return null;
  return (
    <section className="space-y-2" aria-label="Document verification">
      <h3>Document verification</h3>
      {approval.documentVerification.map((report) => (
        <div key={report.name} className="space-y-1">
          <p className="font-semibold">
            {report.name}:{' '}
            {report.status === 'blocked' ? 'Unavailable for export' : 'Content checked'}
          </p>
          {report.findings.map((finding, i) => (
            <p className={finding.severity === 'error' ? 'text-destructive' : 'text-ochre'} key={i}>
              {finding.page ? `Page ${finding.page}: ` : ''}
              {finding.message}
            </p>
          ))}
        </div>
      ))}
      <p className="quiet">
        These checks assess document content and layout. They do not establish ATS compatibility or
        factual accuracy.
      </p>
    </section>
  );
};
