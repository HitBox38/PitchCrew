import type { PipelineReview, RoleId } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { ReviewEvidence } from './ReviewEvidence.tsx';
import { FollowupForm } from './FollowupForm.tsx';

export function PipelineFinding({
  finding,
  review,
  name,
  working,
  action,
}: {
  finding: PipelineReview['findings'][number];
  review: PipelineReview;
  name: (id: RoleId) => string;
  working: boolean;
  action: Action;
}) {
  const followup = review.followups.find((item) => item.findingId === finding.id);
  return (
    <section className="space-y-3 border-t py-3">
      <h5>
        {name(finding.targetRoleId as RoleId)} /{' '}
        {finding.kind === 'hypothesis' ? 'Hypothesis: needs testing' : 'Observation'}
      </h5>
      <p>
        {finding.criterion}: {finding.finding}
      </p>
      <p>
        <strong>Next run:</strong> {finding.nextRunImprovement}
      </p>
      <p>
        <strong>Measure:</strong> {finding.measurement}
      </p>
      <details>
        <summary>Source evidence ({finding.evidenceEventIds.length})</summary>
        {review.evidence
          .filter((event) => finding.evidenceEventIds.includes(event.eventId))
          .map((event) => (
            <ReviewEvidence key={event.eventId} event={event} />
          ))}
      </details>
      <p>
        Follow-up: {followup?.status ?? 'open'}
        {followup?.result ? ` / ${followup.result}` : ''}
      </p>
      {followup?.metrics.map((metric) => (
        <p key={metric.name}>
          {metric.name}: {metric.value} {metric.unit}
        </p>
      ))}
      <details>
        <summary>Record follow-up</summary>
        <FollowupForm review={review} findingId={finding.id} working={working} action={action} />
      </details>
    </section>
  );
}
