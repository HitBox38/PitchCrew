import type { ChatStreamState, ChatStreamUpdate } from '@pitchcrew/core';

export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onState: (state: ChatStreamState) => void,
) {
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
          state = { ...state, ...(JSON.parse(data) as ChatStreamUpdate) };
          onState(state);
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// A single subscription per app; reconnect snapshots restore active previews and
// completed messages without replaying deltas or duplicating chat bubbles.
export function subscribeChatStream(
  onState: (state: ChatStreamState) => void,
  onDisconnect: () => void,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const connect = async () => {
    try {
      const response = await fetch('/api/chat/stream', {
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
}
