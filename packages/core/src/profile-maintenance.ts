import type { ProfileImportFile, ProfileSource } from './profile-sources.ts';
import type { RoleId } from './states.ts';

export interface ProfileMaintenanceChange extends ProfileImportFile {
  before: string | null;
}

/** Exact documents and pinned evidence snapshots; generated notes require user fact verification. */
export interface ProfileMaintenanceProposal {
  id: string;
  roleId: RoleId;
  runId: string;
  source: ProfileSource;
  baseSources: ProfileSource[];
  baseProfile: { name: string; digest: string }[];
  documents: ProfileMaintenanceChange[];
  missing: string[];
  restored?: string[];
  observation?: { previous: string; current: string };
  evidence?: { path: string; url: string; revision: string; content: string }[];
  generated?: boolean;
  status: 'pending' | 'applying' | 'applied' | 'rejected';
  selected?: string[];
  verifiedFacts?: boolean;
  snapshotDigest: string;
  createdAt: string;
  decidedAt?: string;
}
