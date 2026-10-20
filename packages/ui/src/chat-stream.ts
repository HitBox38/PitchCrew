import type { ChatStreamState, ChatStreamUpdate } from '@pitchcrew/core';

export const readChatStream = async (
  body: ReadableStream<Uint8Array>,
  onState: (state: ChatStreamState) => void,
) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let state: ChatStreamState = { messages: [], streamingMessages: [] };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
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
    await reader.cancel().catch(() => {});
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
    try {
      const response = await fetch('/api/chat/stream?view=workspace', {
        signal: controller.signal,
        headers: { 'x-pitchcrew-client': 'ui' },
      });
      if (!response.ok || !response.body) throw new Error('Chat stream unavailable.');
      await readChatStream(response.body, onState);
    } catch {
      // Snapshot polling still provides saved messages while the stream reconnects.
    } finally {
      if (!controller.signal.aborted) {
        onDisconnect();
        timer = setTimeout(connect, 1000);
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
