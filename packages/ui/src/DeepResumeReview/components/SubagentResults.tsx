import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import type { ReviewDetail } from '../types.ts';
import { PerspectiveAssessment } from './PerspectiveAssessment.tsx';
import { ReviewFindings } from './ReviewFindings.tsx';
import { deepReviewStages, reviewPerspectives } from '@pitchcrew/core/deep-review-labels';
import { runtimeLabels } from '@/lib/labels.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
export function SubagentResults({
  detail,
  offset,
  changePage,
}: {
  detail: ReviewDetail;
  offset: number;
  changePage: (offset: number) => void;
}) {
  if (!detail.subagents.length && !offset) return null;
  return (
    <section className="grid gap-3" aria-label="Targeted second opinions">
      <h3>Targeted second opinions</h3>
      {detail.subagents.map((child) => (
        <AccordionSection
          key={child.id}
          className="rounded-xl border border-border p-3"
          triggerClassName="cursor-pointer"
          heading={
            <>
              {reviewPerspectives[child.perspective]} · {deepReviewStages[child.stage]} ·{' '}
              {child.status}
            </>
          }
        >
          <div className="mt-3 grid gap-3">
            <p>{child.focus}</p>
            <p className="optional">
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
      <nav className="flex gap-2" aria-label="Second opinion pages">
        <Button disabled={!offset} onClick={() => changePage(Math.max(0, offset - 20))}>
          Previous opinions
        </Button>
        <Button
          disabled={detail.nextOffset === null}
          onClick={() => {
            if (detail.nextOffset !== null) changePage(detail.nextOffset);
          }}
        >
          Next opinions
        </Button>
      </nav>
    </section>
  );
}
