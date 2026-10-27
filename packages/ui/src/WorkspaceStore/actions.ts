import { pendingJobAction } from './job-actions.ts';
import { api } from '@/api.ts';
import type { Snapshot } from '@pitchcrew/core';
import type { WorkspaceGet, WorkspaceSet, WorkspaceState } from './types.ts';

export const createWorkspaceActions = (
  set: WorkspaceSet,
  get: WorkspaceGet,
  applySnapshot: (snapshot: Snapshot) => void,
): Pick<WorkspaceState, 'reload' | 'action' | 'act'> => {
  let pendingActions = 0;
  return {
    reload: async () => {
      try {
        applySnapshot(await api<Snapshot>('/snapshot?view=workspace'));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Could not connect to the daemon.',
        });
        throw error;
      }
    },
    action: async (path, method = 'POST', body, success) => {
      pendingActions += 1;
      const jobAction = pendingJobAction(path, method, body, get().data);
      set((state) => ({
        working: true,
        pendingJobActions: jobAction
          ? {
              ...state.pendingJobActions,
              [jobAction.cardId]: [...(state.pendingJobActions[jobAction.cardId] ?? []), jobAction],
            }
          : state.pendingJobActions,
      }));
      try {
        const result = await api<unknown>(path, method, body);
        await get().reload();
        if (success)
          set({
            toast: typeof success === 'function' ? success(result) : success,
            toastType: 'success',
          });
        return result;
      } catch (error) {
        set({
          toast: error instanceof Error ? error.message : 'Action failed.',
          toastType: 'error',
        });
        throw error;
      } finally {
        pendingActions -= 1;
        set((state) => {
          const pendingJobActions = { ...state.pendingJobActions };
          if (jobAction) {
            const remaining =
              pendingJobActions[jobAction.cardId]?.filter((item) => item !== jobAction) ?? [];
            if (remaining.length) pendingJobActions[jobAction.cardId] = remaining;
            else delete pendingJobActions[jobAction.cardId];
          }
          return { working: pendingActions > 0, pendingJobActions };
        });
      }
    },
    act: (path, method = 'POST', body, success) => {
      void get()
        .action(path, method, body, success)
        .catch(() => {});
    },
  };
};
