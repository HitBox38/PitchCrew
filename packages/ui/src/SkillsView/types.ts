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
}
export type SkillsViewModel = NonNullable<ReturnType<typeof useSkillsView>>;

export type SkillDialogsProps = Pick<
  SkillsViewModel,
  | 'editing'
  | 'starter'
  | 'creator'
  | 'data'
  | 'filter'
  | 'action'
  | 'working'
  | 'setEditing'
  | 'deleting'
  | 'setDeleting'
  | 'error'
  | 'remove'
>;

export type SkillFiltersProps = Pick<SkillsViewModel, 'filters' | 'filter' | 'onFilter'>;

export type SkillLibraryProps = Pick<
  SkillsViewModel,
  'skills' | 'creator' | 'data' | 'setEditing' | 'working' | 'setError' | 'setDeleting'
>;

export type SkillsToolbarProps = Pick<
  SkillsViewModel,
  'query' | 'setQuery' | 'setStarter' | 'setEditing' | 'working'
>;

export type StarterSkillErrorsProps = Pick<SkillsViewModel, 'data' | 'working' | 'action'>;

export type StarterSkillsProps = Pick<
  SkillsViewModel,
  'data' | 'query' | 'working' | 'setStarter' | 'setEditing'
>;
