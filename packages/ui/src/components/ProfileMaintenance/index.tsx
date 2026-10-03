import type { ProfileSourcesProps } from '../ProfileSources/types.ts';
import { ProposalReview } from './components/ProposalReview.tsx';

export function ProfileMaintenance(props: ProfileSourcesProps) {
  const proposals = (props.data.profileProposals ?? []).filter((proposal) =>
    ['pending', 'applying'].includes(proposal.status),
  );
  if (!proposals.length) return null;
  return (
    <section className="my-5 grid gap-4" aria-label="Profile update proposals">
      <h3>Profile updates to review</h3>
      {proposals.map((proposal) => (
        <ProposalReview
          key={proposal.id + proposal.snapshotDigest}
          {...props}
          proposal={proposal}
        />
      ))}
    </section>
  );
}
