import type { ChatWorkModel } from '@/ChatWork/types.ts';
import { WorkSection } from '@/ChatWork/components/WorkSection.tsx';
import { PipelineReviewCard } from './components/PipelineReviewCard.tsx';

export function PipelineReviews({ data, thread, name, working, action }: ChatWorkModel) {
  const reviews = (data.pipelineReviews ?? []).filter(
    (review) =>
      thread === 'crew' ||
      review.roleId === thread ||
      review.findings.some((finding) => finding.targetRoleId === thread),
  );
  if (!reviews.length) return null;
  return (
    <WorkSection className="chat-work-section">
      <div className="chat-work-heading">
        <div>
          <h3>Pipeline reviews</h3>
          <p>Evidence, next-run improvements and measurable follow-ups.</p>
        </div>
      </div>
      {reviews.map((review) => (
        <PipelineReviewCard
          key={review.id}
          review={review}
          name={name}
          working={working}
          action={action}
        />
      ))}
    </WorkSection>
  );
}
