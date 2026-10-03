import type { PipelineReview, RoleId } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { PipelineFinding } from './PipelineFinding.tsx';
import { timeAgo } from '@/lib/time.ts';

export function PipelineReviewCard({
  review,
  name,
  working,
  action,
}: {
  review: PipelineReview;
  name: (id: RoleId) => string;
  working: boolean;
  action: Action;
}) {
  return (
    <article className="chat-proposal" aria-label={`Pipeline review: ${review.title}`}>
      <header>
        <div>
          <h4>{review.title}</h4>
          <p>
            {name(review.roleId)} / {timeAgo(review.createdAt)}
          </p>
        </div>
      </header>
      <p>
        {review.scope.cardIds.length
          ? `${review.scope.cardIds.length} selected applications`
          : 'All applications'}{' '}
        / {review.scope.from ?? 'Any start date'} to {review.scope.to ?? 'Present'}
      </p>
      <details>
        <summary>Evaluation criteria</summary>
        <ul>
          {review.criteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Seat assessments ({review.seats.length})</summary>
        <ul>
          {review.seats.map((seat) => (
            <li key={seat.roleId}>
              {name(seat.roleId as RoleId)} /{' '}
              {seat.assessment === 'assessed' ? 'Assessed' : 'Insufficient evidence'}:{' '}
              {seat.rationale}
            </li>
          ))}
        </ul>
      </details>
      {review.findings.map((finding) => (
        <PipelineFinding
          key={finding.id}
          finding={finding}
          review={review}
          name={name}
          working={working}
          action={action}
        />
      ))}
      <p>
        Recommendations require your approval before changing any role. Outcomes alone do not
        establish a cause.
      </p>
    </article>
  );
}
