import type { useSkillsView } from '@/SkillsView/hooks/useSkillsView.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { RoleId, Snapshot } from '@pitchcrew/core';

export type SkillFilter = 'all' | 'shared' | RoleId;

export interface SkillsViewProps {
  data: Snapshot;
  action: Action;
  working: boolean;
  filter: SkillFilter;
  onFilter: (filter: SkillFilter) => void;
  selectedId?: string;
  onSelect: (id: string | null) => void;
  updatesOnly: boolean;
  onUpdatesOnly: () => void;
  reviewId?: string;
  onReviewClose: () => void;
}
export type SkillsViewModel = NonNullable<ReturnType<typeof useSkillsView>>;
