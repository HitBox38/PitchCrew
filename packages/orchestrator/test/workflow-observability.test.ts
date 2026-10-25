import { adapters } from '@pitchcrew/adapters';
import type { Run } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import * as roles from '../src/crew/roles.ts';
import { cleanup, setup } from './helpers/daemon.ts';
import { deepReviewFixture } from './helpers/deep-reviews.ts';

afterEach(cleanup);

it.each(['completed', 'cancelled'] as const)(
  'preserves extraction %s outcomes',
  async (outcome) => {
    const { daemon } = await setup(14623);
    const context = daemon.service;
    const record = vi.spyOn(context.diagnostics!, 'record');
    const adapter = vi.spyOn(adapters.demo, 'chat');
    if (outcome === 'cancelled')
      adapter.mockImplementation(
        ({ signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('Private cancellation')), {
              once: true,
            });
          }),
      );
    const card = context.createCard({
      company: 'Fictional',
      title: 'Engineer',
      description: 'Build interfaces.',
    });
    const run = await context.extractApplicationContext(card.id, 'scout');
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledOnce());
    if (outcome === 'cancelled') context.cancelRun(run.id);
    await vi.waitFor(() => expect(context.controllers.has(run.id)).toBe(false));
    expect(context.board.get<Run>('run', run.id).status).toBe(outcome);
    expect(
      record.mock.calls.map(([event, properties]) => [
        event,
        properties.outcome,
        properties.$ai_is_error,
      ]),
    ).toEqual([
      ['$ai_span', outcome, false],
      ['$ai_trace', outcome, false],
    ]);
  },
);

it.each(['setup', 'runtime', 'result'] as const)(
  'records a safe extraction failure at the %s boundary',
  async (boundary) => {
    const { daemon } = await setup(14621);
    const context = daemon.service;
    const record = vi.spyOn(context.diagnostics!, 'record');
    const secret = 'Private posting /Users/fictional/profile.md phx_private';
    const error = new SyntaxError(secret);
    const adapter = vi.spyOn(adapters.demo, 'chat');
    if (boundary === 'setup') vi.spyOn(roles, 'writeRunInstructions').mockRejectedValue(error);
    else if (boundary === 'runtime') adapter.mockRejectedValue(error);
    else adapter.mockResolvedValue({ reply: secret });
    const card = context.createCard({
      company: 'Fictional',
      title: 'Engineer',
      description: secret,
    });
    const run = await context.extractApplicationContext(card.id, 'scout');
    await vi.waitFor(() => expect(context.controllers.has(run.id)).toBe(false));
    expect(context.board.get<Run>('run', run.id).status).toBe('failed');
    const traces = record.mock.calls.filter(([event]) => event === '$ai_trace');
    expect(traces).toHaveLength(1);
    expect(traces[0][1]).toMatchObject({
      mode: 'workflow',
      outcome: 'failed',
      $ai_is_error: true,
      failure_category: 'validation',
    });
    const spans = record.mock.calls.filter(([event]) => event === '$ai_span');
    expect(spans).toHaveLength(boundary === 'setup' ? 0 : 1);
    if (spans.length) {
      expect(spans[0][1]).toMatchObject({
        $ai_trace_id: traces[0][1].$ai_trace_id,
        $ai_parent_id: traces[0][1].$ai_trace_id,
        outcome: boundary === 'runtime' ? 'failed' : 'completed',
      });
    } else expect(adapter).not.toHaveBeenCalled();
    const payload = JSON.stringify(record.mock.calls);
    for (const value of [secret, card.id, run.id]) expect(payload).not.toContain(value);
  },
);

it.each(['runtime', 'result'] as const)(
  'finishes deep-review stage and orchestration traces on %s failure',
  async (boundary) => {
    const { daemon, request, card } = await deepReviewFixture(14622);
    const record = vi.spyOn(daemon.service.diagnostics!, 'record');
    const adapter = vi.spyOn(adapters.demo, 'run');
    if (boundary === 'runtime')
      adapter.mockRejectedValue(new SyntaxError('Private runtime content'));
    else adapter.mockResolvedValue({ role: 'reviewer', passed: true, feedback: [] });
    const { result: run } = await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {});
    await vi.waitFor(() => expect(daemon.service.controllers.has(run.id)).toBe(false));
    expect(daemon.service.board.get<Run>('run', run.id).status).toBe('failed');
    const traces = record.mock.calls.filter(([event]) => event === '$ai_trace');
    const spans = record.mock.calls.filter(([event]) => event === '$ai_span');
    expect(traces).toHaveLength(2);
    expect(spans).toHaveLength(1);
    for (const [, properties] of traces)
      expect(properties).toMatchObject({
        outcome: 'failed',
        failure_category: boundary === 'runtime' ? 'validation' : 'other',
      });
    expect(spans[0][1].outcome).toBe(boundary === 'runtime' ? 'failed' : 'completed');
    expect(
      traces.some(([, properties]) => properties.$ai_trace_id === spans[0][1].$ai_trace_id),
    ).toBe(true);
    expect(JSON.stringify(record.mock.calls)).not.toContain('Private');
  },
);

it('records waiting deep-review traces without reporting a workflow failure', async () => {
  const { daemon, request, card } = await deepReviewFixture(14624);
  const record = vi.spyOn(daemon.service.diagnostics!, 'record');
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    await daemon.service.agentCall(context.mcp.env.PITCHCREW_RUN_TOKEN!, 'ask_user', {
      input: { question: 'Which verified experience should I emphasize?' },
    });
    throw new Error('Private question ends this turn');
  });
  const { result: run } = await request<Run>(`/cards/${card.id}/deep-reviews`, 'POST', {});
  await vi.waitFor(() => expect(daemon.service.controllers.has(run.id)).toBe(false));
  expect(daemon.service.board.get<Run>('run', run.id).status).toBe('waiting');
  const traces = record.mock.calls.filter(([event]) => event === '$ai_trace');
  expect(traces).toHaveLength(2);
  for (const [, properties] of traces)
    expect(properties).toMatchObject({ outcome: 'waiting', $ai_is_error: false });
});
