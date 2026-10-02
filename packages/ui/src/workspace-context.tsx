import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Snapshot, Role, RoleId } from '@pitchcrew/core';
import type { ChatThread, View } from './navigation.ts';

export type Action = (
  path: string,
  method?: string,
  body?: unknown,
  success?: string | ((result: unknown) => string),
) => Promise<unknown>;

export interface Workspace {
  data: Snapshot;
  action: Action;
  working: boolean;
  act: (path: string, method?: string, body?: unknown, success?: string) => void;
  go: (view: View) => void;
  openCard: (id: string) => void;
  openChat: (thread: ChatThread) => void;
  setRoleId: (id: RoleId | null) => void;
  setAdd: (open: boolean) => void;
  roleStatus: (role: Role) => string;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  showClosed: boolean;
  setShowClosed: Dispatch<SetStateAction<boolean>>;
  flashStage: string | null;
  setFlashStage: Dispatch<SetStateAction<string | null>>;
}

export const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('Workspace pages must render inside the app shell.');
  return workspace;
}
