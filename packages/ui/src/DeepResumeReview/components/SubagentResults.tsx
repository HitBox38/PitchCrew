import { AccordionSection } from '@pitchcrew/design-system/accordion';
import type { ReviewDetail } from '../types.ts';
import { PerspectiveAssessment } from './PerspectiveAssessment.tsx';
import { ReviewFindings } from './ReviewFindings.tsx';
import { deepReviewStages, reviewPerspectives } from '@pitchcrew/core/deep-review-labels';
import { runtimeLabels } from '@/lib/labels.ts';
import { Button } from '@pitchcrew/design-system/button';
export const SubagentResults = ({
  detail,
  offset,
  changePage,
}: {
  detail: ReviewDetail;
  offset: number;
  changePage: (offset: number) => void;
}) => {
  if (!detail.subagents.length && !offset) return null;
  return (
    <section className="deep-review-opinions" aria-label="Targeted second opinions">
      <h4>Targeted second opinions</h4>
      {detail.subagents.map((child) => (
        <AccordionSection
          key={child.id}
          heading={
            <>
              {reviewPerspectives[child.perspective]} · {deepReviewStages[child.stage]} ·{' '}
              {child.status}
            </>
          }
        >
          <div className="mt-3 grid gap-3">
            <p>{child.focus}</p>
            <p className="quiet">
              {runtimeLabels[child.runtime]} · {child.model || 'CLI default'}
            </p>
            <p>{child.reason}</p>
            {child.error ? <output>Incomplete: {child.error}</output> : null}
            {child.timeRequest ? (
              <p>
                Requested {child.timeRequest.minutes} extra minutes: {child.timeRequest.reason}
              </p>
            ) : null}
            {child.assessment ? (
              <>
                <PerspectiveAssessment assessment={child.assessment} title="Second opinion" />
                <ReviewFindings findings={child.assessment.findings} />
              </>
            ) : null}
          </div>
        </AccordionSection>
      ))}
      {/* Paging appears only when there is another page to reach. */}
      {offset || detail.nextOffset !== null ? (
        <nav className="flex gap-1" aria-label="Second opinion pages">
          <Button
            variant="ghost"
            size="sm"
            disabled={!offset}
            onClick={() => changePage(Math.max(0, offset - 20))}
          >
            Previous opinions
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={detail.nextOffset === null}
            onClick={() => {
              if (detail.nextOffset !== null) changePage(detail.nextOffset);
            }}
          >
            Next opinions
          </Button>
        </nav>
      ) : null}
    </section>
  );
};
