import type { ChatContext, RuntimeActivity, RuntimeId } from '@pitchcrew/core';
import { describe, expect, it, vi } from 'vitest';
import type { NativeToolEvent } from '../src/activity/native-tools.ts';
import { nativeToolParsers } from '../src/activity/parsers.ts';
import { chatEventStream, partialReply } from '../src/streaming.ts';

describe('structured reply previews', () => {
  it('decodes text at every split without exposing JSON or incomplete escapes', () => {
    const reply = 'Café\n"quoted" \\ slash / שלום 🚀';
    const raw = '```json\n' + JSON.stringify({ reply }) + '\n```';
    for (let end = 0; end <= raw.length; end++) {
      const text = partialReply(raw.slice(0, end));
      expect(reply.startsWith(text)).toBe(true);
      expect(text).not.toMatch(/[\uD800-\uDBFF]$/);
    }
    expect(partialReply(raw)).toBe(reply);
    expect(partialReply('{"reply":"hello \\uD83D')).toBe('hello ');
    expect(partialReply('{"reply":"hello \\uD83D\\uDE80"}')).toBe('hello 🚀');
    expect(partialReply('{"reply":"bad\\q')).toBe('');
    expect(partialReply('{"reply":"bad\n')).toBe('');
    expect(partialReply('{"role":"scout","reasons":["private"]}')).toBe('');
    expect(partialReply('Reasoning: {"reply":"private"}')).toBe('');
    expect(partialReply(JSON.stringify({ reply: 'x'.repeat(13000) }))).toHaveLength(12000);
  });
});

const cases: [RuntimeId, Record<string, unknown>[], Record<string, unknown>][] = [
  [
    'claude-code',
    [
      {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: '{"reply":"Hello' },
        },
      },
      {
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world"}' } },
      },
    ],
    {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'thinking_delta', thinking: 'private' },
      },
    },
  ],
  [
    'codex',
    [
      { type: 'item.updated', item: { id: 'a', type: 'agent_message', text: '{"reply":"Hello' } },
      {
        type: 'item.completed',
        item: { id: 'a', type: 'agent_message', text: '{"reply":"Hello world"}' },
      },
    ],
    { type: 'item.completed', item: { type: 'reasoning', text: 'private' } },
  ],
  [
    'gemini-cli',
    [
      { type: 'message', role: 'assistant', delta: true, content: '{"reply":"Hello' },
      { type: 'message', role: 'assistant', delta: true, content: ' world"}' },
    ],
    { type: 'message', role: 'user', content: 'private' },
  ],
  [
    'copilot-cli',
    [
      { type: 'assistant.message_delta', data: { deltaContent: '{"reply":"Hello' } },
      { type: 'assistant.message_delta', data: { deltaContent: ' world"}' } },
    ],
    { type: 'assistant.reasoning_delta', data: { deltaContent: 'private' } },
  ],
  [
    'cursor-agent',
    [
      {
        type: 'assistant',
        timestamp_ms: 1,
        message: { content: [{ type: 'text', text: '{"reply":"Hello' }] },
      },
      {
        type: 'assistant',
        timestamp_ms: 2,
        message: { content: [{ type: 'text', text: ' world"}' }] },
      },
    ],
    {
      type: 'assistant',
      timestamp_ms: 3,
      model_call_id: 'flush',
      message: { content: [{ type: 'text', text: '{"reply":"Hello world"}' }] },
    },
  ],
  [
    'goose',
    [
      {
        type: 'message',
        message: { role: 'assistant', content: [{ type: 'text', text: '{"reply":"Hello' }] },
      },
      {
        type: 'message',
        message: { role: 'assistant', content: [{ type: 'text', text: ' world"}' }] },
      },
    ],
    { type: 'message', message: { role: 'tool', content: [{ type: 'text', text: 'private' }] } },
  ],
  [
    'grok',
    [
      { type: 'text', data: '{"reply":"Hello' },
      { type: 'text', data: ' world"}' },
    ],
    { type: 'thought', data: 'private' },
  ],
  [
    'pi',
    [
      {
        type: 'message_update',
        message: { role: 'assistant', content: [{ type: 'text', text: '{"reply":"Hello' }] },
      },
      {
        type: 'message_update',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: '{"reply":"Hello world"}' }],
        },
      },
    ],
    { type: 'tool_execution_end', result: { content: [{ type: 'text', text: 'private' }] } },
  ],
  [
    'opencode',
    [
      { type: 'text', part: { type: 'text', text: '{"reply":"Hello' } },
      { type: 'text', part: { type: 'text', text: '{"reply":"Hello world"}' } },
    ],
    { type: 'tool_result', part: { type: 'text', text: 'private' } },
  ],
];
it.each(cases)(
  '%s streams only assistant reply text and replaces final snapshots',
  (runtime, events, ignored) => {
    const onReply = vi.fn();
    const controller = new AbortController();
    const context = {
      role: { runtime },
      messages: [],
      signal: controller.signal,
      onReply,
    } as unknown as ChatContext;
    const stream = chatEventStream(context);
    stream.event(events[0]);
    expect(onReply).toHaveBeenLastCalledWith('Hello');
    stream.event(ignored);
    expect(onReply).toHaveBeenCalledOnce();
    stream.event(events[1]);
    expect(onReply).toHaveBeenLastCalledWith('Hello world');
    stream.replace('{"reply":"Hello world"}');
    expect(onReply).toHaveBeenCalledTimes(2);
    stream.replace('');
    expect(onReply).toHaveBeenLastCalledWith('');
    stream.event(events[0]);
    expect(onReply).toHaveBeenLastCalledWith('Hello');
    controller.abort();
    stream.event(events[1]);
    expect(onReply).toHaveBeenLastCalledWith('Hello');
  },
);

it('streams public commentary separately, holds JSON prefixes, and never exposes thinking or tool payloads', () => {
  const onActivity = vi.fn();
  const onReply = vi.fn();
  const controller = new AbortController();
  const stream = chatEventStream({
    role: { runtime: 'codex' },
    messages: [],
    signal: controller.signal,
    onActivity,
    onReply,
  } as unknown as ChatContext);
  stream.event({
    type: 'item.started',
    item: { id: 'r', type: 'reasoning', text: 'private reasoning' },
  });
  stream.event({
    type: 'item.completed',
    item: { id: 'c', type: 'agent_message', text: 'I’ll check your profile.' },
  });
  stream.event({
    type: 'item.started',
    item: { id: 't', type: 'mcp_tool_call', arguments: { secret: 'private secret' } },
  });
  stream.event({ type: 'item.completed', item: { id: 'a', type: 'agent_message', text: '{' } });
  stream.event({
    type: 'item.updated',
    item: { id: 'a', type: 'agent_message', text: '{"reply":"Hello' },
  });
  stream.event({
    type: 'item.completed',
    item: { id: 'a', type: 'agent_message', text: '{"reply":"Hello world"}' },
  });
  stream.finish();
  expect(onReply).toHaveBeenLastCalledWith('Hello world');
  expect(
    onActivity.mock.calls.map(([entry]) => entry).filter((entry) => entry.kind === 'commentary'),
  ).toEqual([
    expect.objectContaining({ text: 'I’ll check your profile.', status: 'running' }),
    expect.objectContaining({ text: 'I’ll check your profile.', status: 'completed' }),
  ]);
  expect(JSON.stringify(onActivity.mock.calls)).not.toMatch(/private|Hello world|reply/);
  expect(onActivity.mock.calls.some(([entry]) => entry.kind === 'reasoning')).toBe(true);
  controller.abort();
  const count = onActivity.mock.calls.length;
  stream.replace('Late commentary');
  expect(onActivity).toHaveBeenCalledTimes(count);
});

it('ignores nested runtime text and thinking in the parent activity', () => {
  const onActivity = vi.fn();
  const stream = chatEventStream({
    role: { runtime: 'claude-code' },
    messages: [],
    signal: new AbortController().signal,
    onActivity,
  } as unknown as ChatContext);
  stream.event({
    type: 'stream_event',
    parent_tool_use_id: 'child',
    event: {
      type: 'content_block_delta',
      delta: { type: 'thinking_delta', thinking: 'private child' },
    },
  });
  expect(onActivity).not.toHaveBeenCalled();
});

describe('reasoning that arrives in the same message as a call', () => {
  // Goose sends one assistant message with its thinking and the call it led to.
  const gooseTurn = () => {
    const onActivity = vi.fn<(entry: RuntimeActivity) => void>();
    const stream = chatEventStream({
      role: { runtime: 'goose' },
      directory: '/fixture-run',
      messages: [],
      signal: new AbortController().signal,
      onActivity,
    } as unknown as ChatContext);
    const sequence = () => onActivity.mock.calls.map(([entry]) => `${entry.id}:${entry.status}`);
    return { stream, onActivity, sequence };
  };
  const message = (role: string, content: unknown[]) => ({
    type: 'message',
    message: { id: 'msg_fixture', role, created: 1, content },
  });
  const thinking = { type: 'thinking', thinking: 'PRIVATE_REASONING', signature: '' };
  const request = (id: string, name: string, args: Record<string, unknown>) => ({
    type: 'toolRequest',
    id,
    toolCall: { status: 'success', value: { name, arguments: args } },
  });
  const response = (id: string, toolResult: Record<string, unknown>) =>
    message('user', [{ type: 'toolResponse', id, toolResult }]);
  const unparsed = '-32602: Could not interpret tool use parameters for id call_1';

  it('shows the reasoning first, ended by the call it led to', () => {
    const { stream, onActivity, sequence } = gooseTurn();
    stream.event(message('assistant', [thinking, request('call_1', 'shell', { command: 'ls' })]));
    stream.event(
      response('call_1', {
        status: 'success',
        value: { content: [{ type: 'text', text: 'PRIVATE_RESULT' }], isError: false },
      }),
    );
    stream.event(message('assistant', [{ type: 'text', text: 'Done looking.' }]));
    stream.finish();
    expect(sequence()).toEqual([
      'thinking-1:running',
      'thinking-1:completed',
      'native-call_1:running',
      'native-call_1:completed',
      'commentary-2:running',
      'commentary-2:completed',
    ]);
    expect(JSON.stringify(onActivity.mock.calls)).not.toContain('PRIVATE');
  });

  it('ends the reasoning before a call Goose could not parse', () => {
    const { stream, sequence } = gooseTurn();
    stream.event(
      message('assistant', [
        thinking,
        { type: 'toolRequest', id: 'call_1', toolCall: { status: 'error', error: unparsed } },
      ]),
    );
    stream.event(response('call_1', { status: 'error', error: unparsed }));
    stream.event(message('assistant', [{ type: 'text', text: 'Retrying.' }]));
    stream.finish();
    expect(sequence()).toEqual([
      'thinking-1:running',
      'thinking-1:completed',
      'native-call_1:running',
      'native-call_1:failed',
      'commentary-2:running',
      'commentary-2:completed',
    ]);
  });

  it('ends the reasoning for a Pitchcrew call, which only the gateway shows', () => {
    const { stream, sequence } = gooseTurn();
    stream.event(
      message('assistant', [
        thinking,
        request('call_1', 'pitchcrew__pitchcrew_get_card', { cardId: 'PRIVATE_ARG' }),
      ]),
    );
    expect(sequence()).toEqual(['thinking-1:running', 'thinking-1:completed']);
  });
});

it('hands the tool parser each event exactly once on every path', () => {
  const original = nativeToolParsers['claude-code'];
  const parse = vi.fn<(event: Record<string, unknown>) => NativeToolEvent[]>(() => []);
  nativeToolParsers['claude-code'] = () => parse;
  try {
    const events = [
      { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'x' }] } },
      { type: 'assistant', parent_tool_use_id: 'toolu_parent', message: { content: [] } },
      {
        type: 'stream_event',
        event: { type: 'content_block_start', content_block: { type: 'tool_use' } },
      },
      { type: 'result', result: '{"reply":"Done."}' },
    ];
    // A chat turn, where sub-agent events return early, and a deep-review stage.
    for (const shape of [{ messages: [] }, { deepReview: { id: 'fixture' } }]) {
      parse.mockClear();
      const stream = chatEventStream({
        role: { runtime: 'claude-code' },
        directory: '/fixture-run',
        signal: new AbortController().signal,
        onActivity: vi.fn(),
        ...shape,
      } as unknown as ChatContext);
      for (const event of events) stream.event(event);
      expect(parse.mock.calls.map(([event]) => event)).toEqual(events);
    }
  } finally {
    nativeToolParsers['claude-code'] = original;
  }
});

it('keeps the reply and later steps when a tool parser throws', () => {
  const original = nativeToolParsers.codex;
  nativeToolParsers.codex = () => () => {
    throw new Error('Fixture parser failure.');
  };
  try {
    const onReply = vi.fn();
    const onActivity = vi.fn();
    const stream = chatEventStream({
      role: { runtime: 'codex' },
      messages: [],
      signal: new AbortController().signal,
      onActivity,
      onReply,
    } as unknown as ChatContext);
    stream.event({ type: 'item.completed', item: { id: 'r', type: 'reasoning', text: 'x' } });
    stream.event({
      type: 'item.completed',
      item: { id: 'a', type: 'agent_message', text: '{"reply":"Hello"}' },
    });
    expect(onReply).toHaveBeenLastCalledWith('Hello');
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: 'reasoning' }));
  } finally {
    nativeToolParsers.codex = original;
  }
});
