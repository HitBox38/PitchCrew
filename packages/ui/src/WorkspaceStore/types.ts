import type { RoleId, Snapshot } from '@pitchcrew/core';
import type { StoreApi } from 'zustand';

export type Action = (
  path: string,
  method?: string,
  body?: unknown,
  success?: string | ((result: unknown) => string),
) => Promise<unknown>;
export interface WorkspaceState {
  data: Snapshot | null;
  error: string;
  toast: string;
  working: boolean;
  add: boolean;
  selectedId: string | null;
  roleId: RoleId | null;
  recentIds: string[];
  query: string;
  showClosed: boolean;
  flashStage: string | null;
  reload: () => Promise<void>;
  startSync: () => () => void;
  action: Action;
  act: (path: string, method?: string, body?: unknown, success?: string) => void;
  setToast: (toast: string) => void;
  setAdd: (add: boolean) => void;
  setSelectedId: (selectedId: string | null) => void;
  setRoleId: (roleId: RoleId | null) => void;
  setQuery: (query: string) => void;
  setShowClosed: (showClosed: boolean) => void;
  setFlashStage: (flashStage: string | null) => void;
  openCard: (id: string) => void;
  closePanels: () => void;
}
export type WorkspaceSet = StoreApi<WorkspaceState>['setState'];
export type WorkspaceGet = StoreApi<WorkspaceState>['getState'];
