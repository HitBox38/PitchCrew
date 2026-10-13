import { adapters } from '@pitchcrew/adapters';
import type { ChatContext, Run } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, finish, setup } from './helpers/daemon.ts';

afterEach(cleanup);

it('streams bounded activity, preserves outcomes on replay and keeps private payloads out of the timeline', async () => {
  let context!: ChatContext;
  let complete!: () => void;
  vi.spyOn(adapters.demo, 'chat').mockImplementation((turn) => {
    context = turn;
    return new Promise((resolve) => {
      complete = () => resolve({ reply: 'Here is the answer.' });
    });
  });
  const { daemon, request } = await setup(14611);
  const { result: run } = await request<Run>('/roles/scout/chat', 'POST', {
    content: 'Check my profile.',
  });
  await vi.waitFor(() => expect(context).toBeDefined());
  const token = [...daemon.service.capabilities.keys()][0];
  context.onActivity!({
    id: 'thinking',
    kind: 'reasoning',
    label: 'Thinking',
    text: 'private reasoning',
    status: 'completed',
  });
  context.onActivity!({
    id: 'update',
    kind: 'commentary',
    label: 'Progress update',
    text: 'Checking requirements.',
    status: 'completed',
  });
  await daemon.service.agentCall(token, 'profile', { private: 'private arguments' });
  await expect(
    daemon.service.agentCall(token, 'unrecognized_private_tool_name', { secret: 'private secret' }),
  ).rejects.toThrow('not allowed');
  for (let i = 0; i < 8; i++)
    await daemon.service.agentCall(token, 'report_progress', { content: `Public update ${i}` });
  await expect(
    daemon.service.agentCall(token, 'report_progress', { content: 'One too many' }),
  ).rejects.toThrow('Eight');
  const live = daemon.service.chatState().activityRuns!.find((item) => item.id === run.id)!;
  expect(live.activity).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'tool',
        label: 'Reading profile',
        status: 'completed',
        finishedAt: expect.any(String),
      }),
      expect.objectContaining({ kind: 'tool', label: 'Using a crew tool', status: 'failed' }),
    ]),
  );
  expect(JSON.stringify(live.activity)).not.toContain('private');
  expect(daemon.service.board.get<Run>('run', run.id).activity).toBeUndefined();
  expect(daemon.service.board.list('message')).toHaveLength(1);
  complete();
  await finish(request, run.id);
  await vi.waitFor(() =>
    expect(daemon.service.board.get<Run>('run', run.id).activity).toBeDefined(),
  );
  daemon.service.board.rebuild();
  const saved = daemon.service.board.get<Run>('run', run.id);
  expect(saved.activity).toEqual(live.activity);
  expect(daemon.service.chatUpdate(false).activityRuns).toEqual([]);
  expect(daemon.service.chatState().activityRuns!.find((item) => item.id === run.id)?.status).toBe(
    'completed',
  );
  const count = saved.activity!.length;
  context.onActivity!({
    id: 'late',
    kind: 'commentary',
    label: 'Late update',
    text: 'Late',
    status: 'completed',
  });
  expect(daemon.service.board.get<Run>('run', run.id).activity).toHaveLength(count);
});

it('bounds per-run history and text while retaining updates to existing steps', async () => {
  let context!: ChatContext;
  let complete!: () => void;
  vi.spyOn(adapters.demo, 'chat').mockImplementation((turn) => {
    context = turn;
    return new Promise((resolve) => {
      complete = () => resolve({ reply: 'Done' });
    });
  });
  const { daemon, request } = await setup(14612);
  const { result: run } = await request<Run>('/roles/scout/chat', 'POST', { content: 'Check' });
  await vi.waitFor(() => expect(context).toBeDefined());
  for (let i = 0; i < 90; i++)
    context.onActivity!({
      id: `step-${i}`,
      kind: 'commentary',
      label: 'Update',
      text: 'x'.repeat(5000),
      status: 'running',
    });
  context.onActivity!({
    id: 'step-0',
    kind: 'commentary',
    label: 'Update',
    text: 'Finished checking',
    status: 'completed',
  });
  complete();
  await finish(request, run.id);
  await vi.waitFor(() =>
    expect(daemon.service.board.get<Run>('run', run.id).activity).toBeDefined(),
  );
  const saved = daemon.service.board.get<Run>('run', run.id);
  expect(saved.activity).toHaveLength(80);
  expect(saved.activityTruncated).toBe(true);
  expect(saved.activity![0]).toMatchObject({ text: 'Finished checking', status: 'completed' });
  expect(saved.activity![1]).toMatchObject({
    status: 'interrupted',
    finishedAt: expect.any(String),
  });
  expect(saved.activity![1].text).toHaveLength(4000);
});

it('retains interrupted steps after user cancellation and rejects late activity', async () => {
  let context!: ChatContext;
  vi.spyOn(adapters.demo, 'chat').mockImplementation(async (turn) => {
    context = turn;
    turn.onActivity!({ id: 'tool', kind: 'tool', label: 'Reading profile', status: 'running' });
    await new Promise<void>((resolve) =>
      turn.signal.addEventListener('abort', () => resolve(), { once: true }),
    );
    return { reply: 'Late answer' };
  });
  const { daemon, request } = await setup(14613);
  const { result: run } = await request<Run>('/roles/scout/chat', 'POST', { content: 'Check' });
  await vi.waitFor(() => expect(context).toBeDefined());
  await request(`/runs/${run.id}/cancel`, 'POST');
  await vi.waitFor(() =>
    expect(daemon.service.board.get<Run>('run', run.id).activity).toBeDefined(),
  );
  const saved = daemon.service.board.get<Run>('run', run.id);
  expect(saved.status).toBe('cancelled');
  expect(saved.activity![0]).toMatchObject({
    status: 'interrupted',
    finishedAt: expect.any(String),
  });
  context.onActivity!({
    id: 'late',
    kind: 'commentary',
    label: 'Late',
    text: 'Late',
    status: 'completed',
  });
  expect(daemon.service.chatUpdate(false).activityRuns).toEqual([]);
});
