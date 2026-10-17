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

it('bounds compact terminal activity while retaining active runs and recent completions', async () => {
  const activity = (id: string, status: 'running' | 'completed') => ({
    id,
    roleId: 'scout',
    runtime: 'demo' as const,
    threadId: 'scout',
    mode: 'chat' as const,
    cardId: null,
    status,
    startedAt: '',
    finishedAt: null,
    message: '',
  });
  const updates = [
    {
      messages: [],
      streamingMessages: [],
      messageHistory: { revision: '1:1:1', threads: {} },
      activityRuns: [activity('long', 'running')],
    },
    ...Array.from({ length: 80 }, (_, i) => ({
      streamingMessages: [],
      activityRuns: [activity(`done-${i}`, 'completed')],
    })),
    { streamingMessages: [], activityRuns: [activity('long', 'completed')] },
  ];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const update of updates)
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(update)}\n\n`));
      controller.close();
    },
  });
  const states: ChatStreamState[] = [];
  await readChatStream(body, (state) => states.push(state));
  expect(states[80].activityRuns).toHaveLength(51);
  expect(
    states[80].activityRuns?.some((run) => run.id === 'long' && run.status === 'running'),
  ).toBe(true);
  expect(states.at(-1)?.activityRuns).toHaveLength(50);
  expect(states.at(-1)?.activityRuns?.at(-1)?.id).toBe('long');
});
