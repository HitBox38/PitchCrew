import { cardInput, type ChatContext, type RunContext } from '@pitchcrew/core';
import { setTimeout } from 'node:timers/promises';
import { expect, it, vi } from 'vitest';
import { createDemo } from '../src/demo/index.ts';

const context = (signal = new AbortController().signal): RunContext => ({
  card: {
    ...cardInput.parse({ company: 'Example', title: 'Engineer', description: 'Build interfaces' }),
    id: 'fixture',
    state: 'lead',
    fit: null,
    owner: null,
    packet: null,
    feedback: [],
    createdAt: '',
    updatedAt: '',
    sample: true,
  },
  role: {
    id: 'scout',
    name: 'Scout',
    description: 'Fixture',
    runtime: 'demo',
    model: '',
    enabled: true,
    instructions: 'Fixture',
  },
  profile: [],
  directory: process.cwd(),
  mcp: { command: '', args: [], env: {} },
  signal,
  onMessage: vi.fn(),
});
const chatContext = (signal?: AbortSignal): ChatContext => ({
  ...context(signal),
  card: null,
  messages: [],
  request: 'Say hello.',
});
const fastDelay = (_milliseconds: number, signal: AbortSignal) =>
  setTimeout(0, undefined, { signal });

it('keeps presentation timing and ordered activity when the delay is injected', async () => {
  const delays = vi.fn(async (_milliseconds: number, _signal: AbortSignal) => {});
  const adapter = createDemo({ delay: delays });
  const onActivity = vi.fn();
  const onReply = vi.fn();
  const turn = { ...chatContext(), onActivity, onReply };
  const result = await adapter.chat(turn);
  expect(delays.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
    350,
    ...Array(onReply.mock.calls.length - 1).fill(30),
  ]);
  expect(delays.mock.calls.every(([, signal]) => signal === turn.signal)).toBe(true);
  expect(onActivity.mock.calls.map(([activity]) => [activity.kind, activity.status])).toEqual([
    ['commentary', 'completed'],
    ['tool', 'running'],
    ['tool', 'completed'],
  ]);
  expect(onReply.mock.calls.at(-1)).toEqual([result.reply]);
  expect(onReply.mock.calls[0]![0]).toBe(result.reply.slice(0, 32));
  delays.mockClear();
  const run = context();
  expect(await adapter.run(run)).toMatchObject({ role: 'scout', fit: 60 });
  expect(delays.mock.calls).toEqual([[850, run.signal]]);
});

it('keeps fast replies asynchronous and exposes partial text before completion', async () => {
  let firstChunk!: () => void;
  const partial = new Promise<void>((resolve) => {
    firstChunk = resolve;
  });
  const onReply = vi.fn((_reply: string) => firstChunk());
  const adapter = createDemo({ delay: fastDelay });
  const pending = adapter.chat({ ...chatContext(), onReply });
  expect(onReply).not.toHaveBeenCalled();
  await partial;
  expect(onReply).toHaveBeenCalledTimes(1);
  const result = await pending;
  expect(onReply.mock.calls.length).toBeGreaterThan(1);
  expect(onReply.mock.calls.slice(0, -1).every(([reply]) => result.reply.startsWith(reply))).toBe(
    true,
  );
  expect(onReply.mock.calls.at(-1)).toEqual([result.reply]);
});

it('cancels a fast reply between chunks without emitting the complete reply', async () => {
  const controller = new AbortController();
  const onReply = vi.fn((_reply: string) => controller.abort());
  await expect(
    createDemo({ delay: fastDelay }).chat({ ...chatContext(controller.signal), onReply }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(onReply).toHaveBeenCalledTimes(1);
  expect(onReply.mock.calls[0]![0]).toHaveLength(32);
});

it('retains abortable default delays for chats and workflows', async () => {
  const controller = new AbortController();
  controller.abort();
  const adapter = createDemo();
  await expect(adapter.chat(chatContext(controller.signal))).rejects.toMatchObject({
    name: 'AbortError',
  });
  await expect(adapter.run(context(controller.signal))).rejects.toMatchObject({
    name: 'AbortError',
  });
});
