import { create } from 'zustand';
import { createWorkspaceActions } from './actions.ts';
import { recentKey } from './constants.ts';
import { readRecent } from './helpers.ts';
import { createWorkspaceSync } from './sync.ts';
import type { WorkspaceState } from './types.ts';
import { createAppUpdateActions } from './updates.ts';

export type { Action } from './types.ts';
/** Each store owns one snapshot poller, one chat stream and its pending-action count. */
export function createWorkspaceStore() {
  return create<WorkspaceState>()((set, get) => {
    const { applySnapshot, startSync } = createWorkspaceSync(set);
    return {
      data: null,
      error: '',
      toast: '',
      toastType: 'info',
      working: false,
      add: false,
      creatingConversation: false,
      selectedId: null,
      roleId: null,
      recentIds: readRecent(),
      query: '',
      showClosed: false,
      flashStage: null,
      setToast: (toast, toastType = 'info') => set({ toast, toastType }),
      setAdd: (add) => set({ add }),
      setCreatingConversation: (creatingConversation) => set({ creatingConversation }),
      setSelectedId: (selectedId) => set({ selectedId }),
      setRoleId: (roleId) => set({ roleId }),
      setQuery: (query) => set({ query }),
      setShowClosed: (showClosed) => set({ showClosed }),
      setFlashStage: (flashStage) => set({ flashStage }),
      openCard: (id) => {
        const recentIds = [id, ...get().recentIds.filter((other) => other !== id)].slice(0, 5);
        set({ selectedId: id, recentIds });
        try {
          localStorage.setItem(recentKey, JSON.stringify(recentIds));
        } catch {
          /* Recents are a convenience; ignore unavailable storage. */
        }
      },
      closePanels: () =>
        set({ selectedId: null, roleId: null, add: false, creatingConversation: false }),
      startSync,
      ...createWorkspaceActions(set, get, applySnapshot),
      ...createAppUpdateActions(set, get),
    };
  });
}
export const useWorkspaceStore = createWorkspaceStore();
