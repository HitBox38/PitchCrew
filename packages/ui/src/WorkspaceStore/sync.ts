import { mergeChatState } from './chat-state.ts';
import { api } from '@/api.ts';
import { subscribeChatStream } from '@/chat-stream.ts';
import type { ChatStreamState, Snapshot } from '@pitchcrew/core';
import type { WorkspaceSet } from './types.ts';

export const createWorkspaceSync = (set: WorkspaceSet) => {
  let chatState: ChatStreamState | null = null;
  let stopSync: (() => void) | undefined;
  const applySnapshot = (snapshot: Snapshot) =>
    set({ data: mergeChatState(snapshot, chatState), error: '' });
  const startSync = () => {
    if (stopSync) return stopSync;
    let active = true;
    let etag: string | null = null;
    let streamGeneration = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const unsubscribe = subscribeChatStream(
      (state) => {
        if (!active) return;
        chatState = state;
        set(({ data }) => ({ data: data ? mergeChatState(data, state) : data }));
      },
      () => {
        if (active) {
          streamGeneration += 1;
          chatState = null;
          etag = null;
        }
      },
    );
    const poll = async () => {
      const generation = streamGeneration;
      try {
        const snapshot = await api<Snapshot>(
          '/snapshot?view=workspace',
          'GET',
          undefined,
          controller.signal,
          {
            etag,
            updateEtag: (value) => {
              if (active && generation === streamGeneration) etag = value;
            },
          },
        );
        if (active) {
          if (snapshot) applySnapshot(snapshot);
          else set((state) => (state.error ? { error: '' } : state));
        }
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
};
