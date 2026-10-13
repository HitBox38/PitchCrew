import type { ChatStreamState } from '@pitchcrew/core';
import { expect, it, vi } from 'vitest';
import { readChatStream } from '../src/chat-stream.ts';

it('reads split SSE frames and UTF-8 text, ignoring heartbeats', async () => {
  const states: ChatStreamState[] = [
    { messages: [], streamingMessages: [] },
    {
      messages: [],
      streamingMessages: [
        {
          id: 'fixture',
          threadId: 'crew',
          from: 'scout',
          to: 'writer',
          content: 'Café שלום 🚀',
          cardId: null,
          runId: 'run',
          createdAt: '',
        },
      ],
    },
  ];
  const bytes = new TextEncoder().encode(
    ': heartbeat\n\n' + states.map((state) => `data: ${JSON.stringify(state)}\n\n`).join(''),
  );
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  });
  const onState = vi.fn();
  await readChatStream(stream, onState);
  expect(onState.mock.calls.map(([state]) => state)).toEqual(states);
});

it('retains saved messages across preview-only updates', async () => {
  const message = {
    id: 'fixture',
    threadId: 'scout',
    from: 'user',
    to: 'scout',
    content: 'Hello',
    cardId: null,
    runId: 'run',
    createdAt: '',
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          `data: ${JSON.stringify({ messages: [message], streamingMessages: [] })}\n\ndata: {"streamingMessages":[]}\n\n`,
        ),
      );
      controller.close();
    },
  });
  const onState = vi.fn();
  await readChatStream(stream, onState);
  expect(onState).toHaveBeenCalledTimes(2);
  expect(onState).toHaveBeenLastCalledWith({ messages: [message], streamingMessages: [] });
});

it('merges activity snapshots by run ID across reply-only frames and terminal updates', async () => {
  const run = { id: 'run', status: 'running', activity: [{ id: 'tool', status: 'running' }] };
  const finished = { ...run, status: 'completed', activity: [{ id: 'tool', status: 'completed' }] };
  const frames = [
    { messages: [], streamingMessages: [], activityRuns: [run] },
    { streamingMessages: [], activityRuns: [] },
    { streamingMessages: [], activityRuns: [finished] },
    { streamingMessages: [] },
  ];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join(''),
        ),
      );
      controller.close();
    },
  });
  const onState = vi.fn();
  await readChatStream(body, onState);
  expect(onState.mock.calls[1][0].activityRuns).toEqual([run]);
  expect(onState.mock.calls[3][0].activityRuns).toEqual([finished]);
});
