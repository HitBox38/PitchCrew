import type { Action } from '@/WorkspaceStore/index.ts';
import type { useAddOpportunity } from '@/components/AddOpportunity/hooks/useAddOpportunity.ts';

export interface AddOpportunityProps {
  action: Action;
  working: boolean;
  onClose: () => void;
}
export type AddOpportunityModel = NonNullable<ReturnType<typeof useAddOpportunity>>;
