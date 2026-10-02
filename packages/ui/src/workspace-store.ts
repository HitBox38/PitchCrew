import { create } from 'zustand';
import type { ChatStreamState, RoleId, Snapshot } from '@pitchcrew/core';
import { api } from './api.ts';
import { subscribeChatStream } from './chat-stream.ts';

export type Action = (
  path: string,
  method?: string,
  body?: unknown,
  success?: string | ((result: unknown) => string),
) => Promise<unknown>;

interface WorkspaceState {
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

const recentKey = 'pitchcrew-recent-jobs';
function readRecent(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(recentKey) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function createWorkspaceStore() {
  return create<WorkspaceState>()((set, get) => {
    // The stream overlays polling snapshots while connected; never persist previews.
    let chatState: ChatStreamState | null = null;
    let pendingActions = 0;
    let stopSync: (() => void) | undefined;
    const applySnapshot = (snapshot: Snapshot) =>
      set({ data: { ...snapshot, ...chatState }, error: '' });

    return {
      data: null,
      error: '',
      toast: '',
      working: false,
      add: false,
      selectedId: null,
      roleId: null,
      recentIds: readRecent(),
      query: '',
      showClosed: false,
      flashStage: null,
      reload: async () => {
        try {
          applySnapshot(await api<Snapshot>('/snapshot'));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Could not connect to the daemon.',
          });
          throw error;
        }
      },
      // The mounted workspace shell owns this single poller and stream subscription.
      startSync: () => {
        if (stopSync) return stopSync;
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const controller = new AbortController();
        const unsubscribe = subscribeChatStream(
          (state) => {
            if (!active) return;
            chatState = state;
            set(({ data }) => ({ data: data ? { ...data, ...state } : data }));
          },
          () => {
            if (active) chatState = null;
          },
        );
        const poll = async () => {
          try {
            const snapshot = await api<Snapshot>('/snapshot', 'GET', undefined, controller.signal);
            if (active) applySnapshot(snapshot);
          } catch (error) {
            if (active)
              set({
                error: error instanceof Error ? error.message : 'Could not connect to the daemon.',
              });
          } finally {
            if (active) timer = setTimeout(poll, 2000);
          }
        };
        stopSync = () => {
          if (!active) return;
          active = false;
          clearTimeout(timer);
          controller.abort();
          unsubscribe();
          chatState = null;
          stopSync = undefined;
        };
        void poll();
        return stopSync;
      },
      action: async (path, method = 'POST', body, success) => {
        pendingActions += 1;
        set({ working: true });
        try {
          const result = await api<unknown>(path, method, body);
          await get().reload();
          if (success) set({ toast: typeof success === 'function' ? success(result) : success });
          return result;
        } catch (error) {
          set({ toast: error instanceof Error ? error.message : 'Action failed.' });
          throw error;
        } finally {
          pendingActions -= 1;
          set({ working: pendingActions > 0 });
        }
      },
      act: (path, method = 'POST', body, success) => {
        void get()
          .action(path, method, body, success)
          .catch(() => {});
      },
      setToast: (toast) => set({ toast }),
      setAdd: (add) => set({ add }),
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
      closePanels: () => set({ selectedId: null, roleId: null, add: false }),
    };
  });
}

export const useWorkspaceStore = createWorkspaceStore();
