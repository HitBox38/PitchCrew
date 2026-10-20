import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import type { ReviewDetail } from '../types.ts';
import { PerspectiveAssessment } from './PerspectiveAssessment.tsx';
import { ReviewFindings } from './ReviewFindings.tsx';
import { SubagentResults } from './SubagentResults.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { deepReviewStages } from '@pitchcrew/core/deep-review-labels';
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
  const screen = (stage: 'before' | 'after') =>
    report[stage]?.perspectives.find((p) => p.perspective === 'screen')?.verdict ?? 'Incomplete';
  return (
    <article className="grid gap-6" aria-label="Deep review report">
      {report.status === 'completed' && currentReviewRunId !== report.runId ? (
        <p className="optional">
          Historical report. Current packet readiness is shown in this job’s actions.
        </p>
      ) : null}
      <header className="space-y-2">
        <h3>{report.summary}</h3>
        <p className="optional">
          {report.status === 'running'
            ? deepReviewStages[report.stage]
            : report.status.replaceAll('_', ' ')}{' '}
          · Started {new Date(report.createdAt).toLocaleString()}
        </p>
        {report.status === 'running' ? (
          <p>Shared deadline: {new Date(report.deadlineAt).toLocaleTimeString()}</p>
        ) : null}
        {report.error ? <p role="alert">{report.error}</p> : null}
        <p>
          Heuristic screen: {screen('before')} → {screen('after')}. This is not an ATS test or a
          hiring decision.
        </p>
      </header>
      {report.before ? (
        <PerspectiveAssessment assessment={report.before} title="Initial seven perspectives" />
      ) : null}
      {report.before ? <ReviewFindings findings={report.before.findings} /> : null}
      {report.after ? (
        <AccordionSection
          defaultOpen
          triggerClassName="cursor-pointer font-semibold"
          heading="Final recheck"
        >
          <div className="mt-3 grid gap-4">
            <PerspectiveAssessment assessment={report.after} title="Rechecked perspectives" />
            <ReviewFindings findings={report.after.findings} />
          </div>
        </AccordionSection>
      ) : null}
      <AccordionSection
        triggerClassName="cursor-pointer font-semibold"
        heading="Before and after resume"
      >
        {report.originalResume ? (
          <SourceBlock label="Original resume" value={report.originalResume} />
        ) : (
          <p>The first draft has not completed yet.</p>
        )}
        {report.finalResume ? (
          <SourceBlock label="Improved resume" value={report.finalResume} />
        ) : (
          <p>The final recheck has not completed yet.</p>
        )}
      </AccordionSection>
      <SubagentResults detail={detail} offset={childPage} changePage={changeChildPage} />
      {report.extensions.length ? (
        <AccordionSection
          triggerClassName="cursor-pointer"
          heading={<>Deadline extensions ({report.extensions.length})</>}
        >
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {report.extensions.map((extension, index) => (
              <li key={index}>
                {extension.minutes} minutes: {extension.reason}
              </li>
            ))}
          </ul>
        </AccordionSection>
      ) : null}
      <p className="optional">
        This report applies to the saved resume and job context it assessed. Current packet export
        and submission require their existing approvals.
      </p>
    </article>
  );
};
