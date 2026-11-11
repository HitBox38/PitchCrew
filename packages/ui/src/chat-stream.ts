import { sessionFetch } from './session.ts';
import type { ChatStreamState, ChatStreamUpdate } from '@pitchcrew/core';

export const readChatStream = async (
  body: ReadableStream<Uint8Array>,
  onState: (state: ChatStreamState) => void,
  signal?: AbortSignal,
) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    // Do not wait for the underlying source's cancellation hook: a broken transport
    // must not keep the read loop or subscription shutdown waiting indefinitely.
    void reader.cancel().catch(() => {});
  };
  const received = () => {
    clearTimeout(watchdog);
    // The daemon sends a heartbeat every 15 seconds, even with no agent activity.
    watchdog = setTimeout(cancel, 45_000);
  };
  let buffer = '';
  let state: ChatStreamState = { messages: [], streamingMessages: [] };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (signal?.aborted) return;
    received();
    for (;;) {
      const { value, done } = await reader.read();
      if (done || signal?.aborted) return;
      if (value.byteLength) received();
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) {
          const update = JSON.parse(data) as ChatStreamUpdate;
          const runs = update.activityRuns
            ? mergeActivityRuns(
                state.activityRuns ?? [],
                update.activityRuns,
                !!(update.messageHistory ?? state.messageHistory),
              )
            : state.activityRuns;
          state = { ...state, ...update, ...(runs ? { activityRuns: runs } : {}) };
          onState(state);
        }
      }
    }
  } finally {
    clearTimeout(watchdog);
    signal?.removeEventListener('abort', cancel);
    cancel();
    reader.releaseLock();
  }
};

// A single subscription per app; reconnect snapshots restore active previews and
// completed messages without replaying deltas or duplicating chat bubbles.
export const subscribeChatStream = (
  onState: (state: ChatStreamState) => void,
  onDisconnect: () => void,
) => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const connect = async () => {
    const connection = new AbortController();
    const abortConnection = () => connection.abort();
    controller.signal.addEventListener('abort', abortConnection, { once: true });
    // A local SSE route should establish promptly. Bound only response headers;
    // after that, readChatStream supervises the daemon's ongoing heartbeats.
    const establishment = setTimeout(abortConnection, 15_000);
    try {
      if (controller.signal.aborted) return;
      const response = await sessionFetch('/api/chat/stream?view=workspace', {
        signal: connection.signal,
      });
      clearTimeout(establishment);
      if (!response.ok || !response.body) {
        void response.body?.cancel().catch(() => {});
        throw new Error('Chat stream unavailable.');
      }
      await readChatStream(response.body, onState, connection.signal);
    } catch {
      // Snapshot polling still provides saved messages while the stream reconnects.
    } finally {
      clearTimeout(establishment);
      controller.signal.removeEventListener('abort', abortConnection);
      connection.abort();
      if (!controller.signal.aborted) {
        onDisconnect();
        if (!controller.signal.aborted) timer = setTimeout(connect, 1000);
      }
    }
  };
  void connect();
  return () => {
    controller.abort();
    clearTimeout(timer);
  };
};

/** Keep live overlays and recent terminal handoffs; saved history is loaded page by page. */
const mergeActivityRuns = (
  previous: NonNullable<ChatStreamState['activityRuns']>,
  incoming: NonNullable<ChatStreamState['activityRuns']>,
  compact: boolean,
) => {
  const runs = new Map(previous.map((run) => [run.id, run]));
  for (const run of incoming) {
    runs.delete(run.id);
    runs.set(run.id, run);
  }
  const values = [...runs.values()];
  return compact
    ? [
        ...values.filter((run) => run.status !== 'running').slice(-50),
        ...values.filter((run) => run.status === 'running'),
      ]
    : values;
};
