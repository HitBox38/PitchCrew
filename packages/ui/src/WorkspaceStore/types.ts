import type { RoleId, Snapshot } from '@pitchcrew/core';
import type { StoreApi } from 'zustand';
import type { AppUpdateState } from './updates.ts';
import type { SkillUpdateActions } from './skill-updates.ts';

export type Action = (
  path: string,
  method?: string,
  body?: unknown,
  success?: string | ((result: unknown) => string),
) => Promise<unknown>;
export interface WorkspaceState extends AppUpdateState, SkillUpdateActions {
  data: Snapshot | null;
  error: string;
  toast: string;
  toastType: 'success' | 'error' | 'info';
  working: boolean;
  add: boolean;
  creatingConversation: boolean;
  selectedId: string | null;
  selectedJobSection: 'job' | 'application' | 'activity';
  roleId: RoleId | null;
  recentIds: string[];
  query: string;
  showClosed: boolean;
  flashStage: string | null;
  reload: () => Promise<void>;
  startSync: () => () => void;
  action: Action;
  act: (path: string, method?: string, body?: unknown, success?: string) => void;
  setToast: (toast: string, type?: WorkspaceState['toastType']) => void;
  setAdd: (add: boolean) => void;
  setCreatingConversation: (open: boolean) => void;
  setSelectedId: (selectedId: string | null) => void;
  setRoleId: (roleId: RoleId | null) => void;
  setQuery: (query: string) => void;
  setShowClosed: (showClosed: boolean) => void;
  setFlashStage: (flashStage: string | null) => void;
  openCard: (id: string, section?: 'job' | 'application' | 'activity') => void;
  closePanels: () => void;
}
export type WorkspaceSet = StoreApi<WorkspaceState>['setState'];
export type WorkspaceGet = StoreApi<WorkspaceState>['getState'];
