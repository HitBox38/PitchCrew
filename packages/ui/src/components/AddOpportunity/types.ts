import type { Action } from '@/WorkspaceStore/index.ts';
import type { Card, Snapshot } from '@pitchcrew/core';
import type { useAddOpportunity } from '@/components/AddOpportunity/hooks/useAddOpportunity.ts';

export interface AddOpportunityProps {
  data: Snapshot;
  action: Action;
  working: boolean;
  card?: Card;
  saveBlocker?: string;
  onClose: () => void;
}
export type AddOpportunityModel = NonNullable<ReturnType<typeof useAddOpportunity>>;
