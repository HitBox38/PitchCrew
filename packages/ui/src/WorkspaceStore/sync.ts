import { api } from '@/api.ts';
import { subscribeChatStream } from '@/chat-stream.ts';
import type { ChatStreamState, Snapshot } from '@pitchcrew/core';
import type { WorkspaceSet } from './types.ts';

export function createWorkspaceSync(set: WorkspaceSet) {
  let chatState: ChatStreamState | null = null;
  let stopSync: (() => void) | undefined;
  const applySnapshot = (snapshot: Snapshot) =>
    set({ data: { ...snapshot, ...chatState }, error: '' });
  const startSync = () => {
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
  };
  return { applySnapshot, startSync };
}
