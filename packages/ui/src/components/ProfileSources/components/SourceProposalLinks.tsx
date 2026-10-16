import type { ProfileMaintenanceProposal } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export function SourceProposalLinks({
  proposals,
  controller: c,
}: {
  proposals: ProfileMaintenanceProposal[];
  controller: ProfileSourcesModel;
}) {
  if (!proposals.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="profile-source-badge profile-source-review-badge">
        {proposals.some((p) => p.status === 'applying')
          ? 'Update needs recovery'
          : 'Updates to review'}
        {proposals.length > 1 ? ` (${proposals.length})` : ''}
      </span>
      {proposals.map((proposal, index) => (
        <Button
          key={proposal.id}
          size="sm"
          disabled={c.busy}
          data-source-focus={`review-${proposal.id}`}
          onClick={() => c.reviewProposal(proposal.id)}
          aria-label={
            proposals.length > 1
              ? `Review update ${index + 1} for ${proposal.source.label}`
              : `Review ${proposal.source.label}`
          }
        >
          {proposals.length > 1 ? `Review ${index + 1}` : 'Review'}
        </Button>
      ))}
    </div>
  );
}
