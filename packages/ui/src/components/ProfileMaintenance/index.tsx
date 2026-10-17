import type { ProposalReviewProps } from './types.ts';
import { ProposalReview } from './components/ProposalReview.tsx';

export function ProfileMaintenance(props: ProposalReviewProps) {
  return (
    <section aria-label="Profile update review">
      <ProposalReview key={props.proposal.id + props.proposal.snapshotDigest} {...props} />
    </section>
  );
}
