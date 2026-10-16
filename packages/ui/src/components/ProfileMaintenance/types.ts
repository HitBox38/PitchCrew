import type { ProfileFile, ProfileMaintenanceProposal } from '@pitchcrew/core';
import type { ProfileSourcesProps } from '../ProfileSources/types.ts';

export interface ProposalReviewProps extends ProfileSourcesProps {
  proposal: ProfileMaintenanceProposal;
  onReviewed: (file: ProfileFile | undefined, approved: boolean) => void;
  onPendingChange: (pending: boolean) => void;
}
