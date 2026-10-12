import { confirmFixtureApplication } from './helpers/daemon.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapters } from '@pitchcrew/adapters';
import type { Card, Run } from '@pitchcrew/core';
import { cleanup, finish, setup } from './helpers/daemon.ts';
import { beginAiRun } from '../src/telemetry/ai.ts';
import { sanitizeAiObservation } from '@pitchcrew/core/telemetry-ai';
import { createTelemetryBuffer } from '../src/telemetry/buffer.ts';

const trace = 'b7cf24c4-2c2e-4fda-85d3-b4b45c6a1798';
const span = '482416cb-8624-4b9f-9637-ad0dc6884169';
const wall = 1_797_000_000_000;
afterEach(cleanup);
function fixture() {
  let now = 0;
  const record = vi.fn();
  const ids = [trace, span];
  const ai = beginAiRun({ record }, 'chat', {
    clock: () => now,
    wallClock: () => wall + now,
    id: () => ids.shift()!,
  });
  return {
    ai,
    record,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('AI runtime boundaries', () => {
  it('instruments actual workflow and chat launches without board IDs or private context', async () => {
    const { daemon, request } = await setup(14589);
    const record = vi.spyOn(daemon.service.diagnostics!, 'record');
    await request('/profile', 'PUT', {
      name: 'profile.md',
      content: '# Private Candidate\nBuilt interfaces.',
    });
    const { result: card } = await request<Card>('/cards', 'POST', {
      company: 'Private Employer',
      title: 'Private Engineer',
      description: 'Private posting',
    });
    await confirmFixtureApplication(request, card.id);
    const { result: workflow } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'scout',
    });
    await finish(request, workflow.id);
    vi.spyOn(adapters.demo, 'chat').mockResolvedValueOnce({ reply: 'Private answer' });
    const { result: chat } = await request<Run>('/roles/scout/chat', 'POST', {
      content: 'Private prompt',
    });
    await finish(request, chat.id);
    await vi.waitFor(() => expect(record).toHaveBeenCalledTimes(4));
    expect(record.mock.calls.map(([event, properties]) => [event, properties.mode])).toEqual([
      ['$ai_span', 'workflow'],
      ['$ai_trace', 'workflow'],
      ['$ai_span', 'chat'],
      ['$ai_trace', 'chat'],
    ]);
    const payload = JSON.stringify(record.mock.calls);
    for (const secret of ['Private', card.id, workflow.id, chat.id])
      expect(payload).not.toContain(secret);
    expect(payload).not.toContain('$ai_generation');
  });
  it('measures real runtime duration in seconds, emits child before trace, and never reads result content', async () => {
    const f = fixture();
    f.advance(1000);
    const result = { reply: 'private reply', usage: { tokens: 700 }, model: 'private model' };
    expect(
      await f.ai.observe(async () => {
        f.advance(2300);
        return result;
      }, new AbortController().signal),
    ).toBe(result);
    f.advance(200);
    f.ai.finish('completed');
    f.ai.finish('failed');
    expect(f.record.mock.calls).toEqual([
      [
        '$ai_span',
        {
          $ai_trace_id: trace,
          $ai_span_id: span,
          $ai_parent_id: trace,
          $ai_span_name: 'runtime_execution',
          $ai_latency: 2.3,
          mode: 'chat',
          outcome: 'completed',
          observation_level: 'runtime_boundary',
          $ai_is_error: false,
          observed_start_ms: wall + 1000,
        },
      ],
      [
        '$ai_trace',
        {
          $ai_trace_id: trace,
          $ai_trace_name: 'chat_turn',
          $ai_latency: 3.5,
          mode: 'chat',
          outcome: 'completed',
          observation_level: 'runtime_boundary',
          $ai_is_error: false,
          observed_start_ms: wall,
        },
      ],
    ]);
    expect(JSON.stringify(f.record.mock.calls)).not.toMatch(/private|tokens|model|usage/);
  });
  it('preserves the exact runtime failure without leaking messages, paths or credentials', async () => {
    const f = fixture();
    const error = new Error('private /Users/example/resume.md phx_secret');
    await expect(
      f.ai.observe(async () => {
        f.advance(4000);
        throw error;
      }, new AbortController().signal),
    ).rejects.toBe(error);
    f.ai.finish('failed');
    expect(f.record.mock.calls[0][1]).toMatchObject({
      outcome: 'failed',
      $ai_is_error: true,
      $ai_latency: 4,
    });
    expect(JSON.stringify(f.record.mock.calls)).not.toMatch(/private|resume|phx/);
  });
  it('distinguishes cancellation and waiting from failures', async () => {
    const f = fixture();
    const controller = new AbortController();
    await f.ai.observe(async () => {
      controller.abort();
      return null;
    }, controller.signal);
    f.ai.finish('waiting');
    expect(f.record.mock.calls[0][1]).toMatchObject({ outcome: 'cancelled', $ai_is_error: false });
    expect(f.record.mock.calls[1][1]).toMatchObject({ outcome: 'waiting', $ai_is_error: false });
  });
  it('captures setup failures without inventing runtime execution', () => {
    const f = fixture();
    f.advance(1500);
    f.ai.finish('failed');
    expect(f.record).toHaveBeenCalledOnce();
    expect(f.record.mock.calls[0][0]).toBe('$ai_trace');
  });
  it('does not change execution when the diagnostics sink throws', async () => {
    const ai = beginAiRun(
      {
        record() {
          throw new Error('collector failure');
        },
      },
      'workflow',
    );
    expect(await ai.observe(async () => 42, new AbortController().signal)).toBe(42);
    expect(() => ai.finish('completed')).not.toThrow();
  });
  it('remains offline and emits nothing when the buffer is disabled', async () => {
    const buffer = createTelemetryBuffer(sanitizeAiObservation);
    const ai = beginAiRun(buffer, 'workflow');
    await ai.observe(async () => 'unchanged', new AbortController().signal);
    ai.finish('completed');
    expect(buffer.read(0).observations).toEqual([]);
  });
});

describe('AI sanitizer', () => {
  const input = { $ai_trace_id: trace, mode: 'workflow', outcome: 'completed', $ai_latency: 7.5 };
  it('rebuilds all properties and replaces names with fixed labels', () => {
    const value = sanitizeAiObservation('$ai_trace', {
      ...input,
      $ai_trace_name: 'Private company',
      $ai_input: ['secret'],
      $ai_output_state: 'private',
      $ai_model: 'private',
      $ai_input_tokens: 8,
      run_id: trace,
      url: 'private',
      $ai_is_error: true,
    });
    expect(value).toEqual({
      ...input,
      $ai_trace_name: 'workflow_turn',
      observation_level: 'runtime_boundary',
      $ai_is_error: false,
    });
  });
  it.each([
    ['$ai_generation', input],
    ['$ai_trace', { ...input, mode: 'private role' }],
    ['$ai_trace', { ...input, outcome: 'private error' }],
    ['$ai_trace', { ...input, $ai_trace_id: 'board-run-secret' }],
    ['$ai_trace', { ...input, $ai_latency: Infinity }],
    ['$ai_trace', { ...input, $ai_latency: -1 }],
    ['$ai_span', { ...input, $ai_span_id: span, $ai_parent_id: span }],
  ])('rejects unknown event shapes and unbounded measurements %#', (event, properties) => {
    expect(
      sanitizeAiObservation(event as string, properties as Record<string, unknown>),
    ).toBeNull();
  });
  it('rejects invalid local capture timestamps without dropping valid observations', () => {
    expect(
      sanitizeAiObservation('$ai_trace', { ...input, observed_start_ms: -5 }),
    ).not.toHaveProperty('observed_start_ms');
  });
});
