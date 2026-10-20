import type { Action } from '@/WorkspaceStore/index.ts';
import type { Snapshot } from '@pitchcrew/core';
import type { useAddOpportunity } from '@/components/AddOpportunity/hooks/useAddOpportunity.ts';

export interface AddOpportunityProps {
  data: Snapshot;
  action: Action;
  working: boolean;
  onClose: () => void;
}
export type AddOpportunityModel = NonNullable<ReturnType<typeof useAddOpportunity>>;
