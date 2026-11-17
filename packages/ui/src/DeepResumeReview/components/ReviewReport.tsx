import { ReviewExtensions } from './ReviewExtensions.tsx';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import type { ReviewDetail } from '../types.ts';
import { PerspectiveComparison } from './PerspectiveComparison.tsx';
import { ReviewFindings } from './ReviewFindings.tsx';
import { ReviewStages } from './ReviewStages.tsx';
import { SubagentResults } from './SubagentResults.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { timeAgo } from '@/lib/time.ts';

const statusLabels: Record<ReviewDetail['report']['status'], string> = {
  running: 'In progress',
  waiting: 'Waiting for you',
  completed: 'Completed',
  needs_changes: 'Needs changes',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/**
 * A deep review report reads in the order the user acts on it: what is still open, how the seven
 * perspectives moved, then the resume versions and second opinions as evidence.
 */
export const ReviewReport = ({
  detail,
  childPage,
  changeChildPage,
  currentReviewRunId,
}: {
  detail: ReviewDetail;
  currentReviewRunId?: string;
  childPage: number;
  changeChildPage: (offset: number) => void;
}) => {
  const { report } = detail;
  const running = report.status === 'running';
  const historical = report.status === 'completed' && currentReviewRunId !== report.runId;
  return (
    <article className="deep-review-report" aria-label="Deep review report">
      <header className="grid gap-2">
        <h4>{report.summary}</h4>
        <p className="quiet">
          {running ? 'In progress' : statusLabels[report.status]} ·{' '}
          <time dateTime={report.createdAt} title={new Date(report.createdAt).toLocaleString()}>
            {timeAgo(report.createdAt)}
          </time>
          {running ? ` · Shared deadline ${new Date(report.deadlineAt).toLocaleTimeString()}` : ''}
        </p>
        {running ? <ReviewStages stage={report.stage} /> : null}
        {report.error ? (
          <p role="alert" className="form-error">
            {report.error}
          </p>
        ) : null}
        {historical ? (
          <p className="quiet">Historical report. The dock shows what the current packet needs.</p>
        ) : null}
      </header>
      {report.before ? (
        <ReviewFindings
          findings={(report.after ?? report.before).findings}
          title={report.after ? 'Still open after corrections' : 'What Reviewer found'}
        />
      ) : null}
      {report.before ? <PerspectiveComparison before={report.before} after={report.after} /> : null}
      {report.after && report.before?.findings.length ? (
        <AccordionSection heading="Findings before corrections">
          <ReviewFindings findings={report.before.findings} title="Before corrections" />
        </AccordionSection>
      ) : null}
      <AccordionSection heading="Before and after resume">
        {report.originalResume ? (
          <SourceBlock label="Original resume" value={report.originalResume} />
        ) : (
          <p className="quiet">The first draft has not completed yet.</p>
        )}
        {report.finalResume ? (
          <SourceBlock label="Improved resume" value={report.finalResume} />
        ) : (
          <p className="quiet">The final recheck has not completed yet.</p>
        )}
      </AccordionSection>
      <SubagentResults detail={detail} offset={childPage} changePage={changeChildPage} />
      <ReviewExtensions extensions={report.extensions} />
      <p className="quiet">
        Simulated hiring perspectives on the resume and brief this review assessed, not an ATS test
        or a hiring decision. Export and submission keep their own approvals.
      </p>
    </article>
  );
};
