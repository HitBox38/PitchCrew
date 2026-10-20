import type { ProfileMaintenanceProposal } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';

export const saveReviewDecision = (
  action: Action,
  proposal: ProfileMaintenanceProposal,
  names: string[],
  verifiedFacts: boolean,
  approved: boolean,
) => {
  return action(
    `/profile/proposals/${proposal.id}/decide`,
    'POST',
    {
      approved,
      names,
      verifiedFacts,
      snapshotDigest: proposal.snapshotDigest,
    },
    approved ? 'Verified profile updates applied' : 'Profile updates rejected',
  );
};
