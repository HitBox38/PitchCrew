import { afterEach, expect, it, vi } from 'vitest';
import { adapters } from '@pitchcrew/adapters';
import type {
  ChatContext,
  ChatRequest,
  ChatResult,
  Conversation,
  WorkspaceQueue,
} from '@pitchcrew/core';
import { cleanup, setup, waitForSnapshot } from './helpers/daemon.ts';

// This is an automated adapter fixture, never used for the live real-runtime preview.
const held = () => {
  const turns: { context: ChatContext; complete: () => void; fail: () => void }[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(
    (context) =>
      new Promise<ChatResult>((resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(new Error('Cancelled.')), {
          once: true,
        });
        turns.push({
          context,
          complete: () => resolve({ reply: 'Done.' }),
          fail: () => reject(new Error('Fixture failure.')),
        });
      }),
  );
  return turns;
};
afterEach(cleanup);

it('rejects a later-row resume and paused Make next without changing the queue, then Resume all continues unstarted messages', async () => {
  const { request } = await setup(23971);
  const turns = held();
  const thread = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Recovery',
      participants: ['scout'],
    })
  ).result;
  const send = async (content: string) =>
    (await request<ChatRequest>(`/conversations/${thread.id}/messages`, 'POST', { content }))
      .result;
  await send('Original');
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const second = await send('Second');
  const third = await send('Third');
  await request(`/conversations/${thread.id}/stop`, 'POST');
  await waitForSnapshot(request, (s) => s.runs.every((run) => run.status !== 'running'));
  const before = (await request<WorkspaceQueue>('/queue')).result.queues[0];
  expect(
    (await request(`/chat-requests/${third.id}`, 'PUT', { action: 'resume' })).response.status,
  ).toBe(400);
  expect(
    (await request(`/chat-requests/${third.id}`, 'PUT', { action: 'next' })).response.status,
  ).toBe(400);
  expect((await request<WorkspaceQueue>('/queue')).result.queues[0]).toEqual(before);
  expect(turns).toHaveLength(1);
  await request(`/queue/${encodeURIComponent(before.id)}`, 'PUT', { action: 'resume' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(turns[1].context.request).toBe('Second');
  turns[1].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe('Third');
  turns[2].complete();
  const snapshot = await waitForSnapshot(
    request,
    (s) => s.chatRequests?.find((r) => r.id === third.id)?.deliveries[0].status === 'completed',
  );
  expect(snapshot.chatRequests?.find((r) => r.id === second.id)?.deliveries[0].status).toBe(
    'completed',
  );
  expect(turns.filter((t) => t.context.request === 'Original')).toHaveLength(1);
});

it('retries only the unfinished group recipient and automatically continues downstream never-started paused messages', async () => {
  const { request } = await setup(23972);
  const turns = held();
  const thread = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Partial recovery',
      participants: ['scout', 'writer'],
    })
  ).result;
  const first = (
    await request<ChatRequest>(`/conversations/${thread.id}/messages`, 'POST', {
      content: 'Initial group request',
    })
  ).result;
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  turns.find((turn) => turn.context.role.id === 'scout')!.complete();
  const completed = await waitForSnapshot(
    request,
    (s) =>
      s.chatRequests?.find((r) => r.id === first.id)?.deliveries.find((d) => d.roleId === 'scout')
        ?.status === 'completed',
  );
  const scoutRunId = completed
    .chatRequests!.find((r) => r.id === first.id)!
    .deliveries.find((d) => d.roleId === 'scout')!.runId;
  const later: ChatRequest[] = [];
  for (const content of ['@scout Second', '@scout Third'])
    later.push(
      (await request<ChatRequest>(`/conversations/${thread.id}/messages`, 'POST', { content }))
        .result,
    );
  await request(`/conversations/${thread.id}/stop`, 'POST');
  await waitForSnapshot(request, (s) => s.runs.every((run) => run.status !== 'running'));
  expect(
    (await request(`/chat-requests/${first.id}`, 'PUT', { action: 'resume' })).response.status,
  ).toBe(200);
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.role.id).toBe('writer');
  turns[2].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(4));
  expect(turns[3].context.request).toBe('@scout Second');
  turns[3].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(5));
  expect(turns[4].context.request).toBe('@scout Third');
  turns[4].complete();
  const final = await waitForSnapshot(
    request,
    (s) => s.chatRequests?.find((r) => r.id === later[1].id)?.deliveries[0].status === 'completed',
  );
  expect(
    final
      .chatRequests!.find((r) => r.id === first.id)!
      .deliveries.find((d) => d.roleId === 'scout'),
  ).toMatchObject({ status: 'completed', runId: scoutRunId });
});

it('requires another explicit retry when a different failed attempt reaches the head', async () => {
  const { request } = await setup(23973);
  const turns = held();
  const thread = (
    await request<Conversation>('/conversations', 'POST', {
      title: 'Separate failures',
      participants: ['scout'],
    })
  ).result;
  const first = (
    await request<ChatRequest>(`/conversations/${thread.id}/messages`, 'POST', {
      content: 'First failure',
    })
  ).result;
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  turns[0].fail();
  await waitForSnapshot(
    request,
    (s) => s.chatRequests?.find((r) => r.id === first.id)?.deliveries[0].status === 'failed',
  );
  const second = (
    await request<ChatRequest>(`/conversations/${thread.id}/messages`, 'POST', {
      content: 'Explicitly send first',
      intent: 'interrupt',
    })
  ).result;
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  turns[1].fail();
  await waitForSnapshot(
    request,
    (s) => s.chatRequests?.find((r) => r.id === second.id)?.deliveries[0].status === 'failed',
  );
  await request(`/conversations/${thread.id}/messages`, 'POST', { content: 'After both' });
  await request(`/chat-requests/${second.id}`, 'PUT', { action: 'resume' });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  turns[2].complete();
  const final = await waitForSnapshot(
    request,
    (s) =>
      s.queue?.queues.some(
        (q) => q.threadId === thread.id && q.paused && q.pauseKind === 'failed',
      ) === true,
  );
  expect(turns).toHaveLength(3);
  expect(final.chatRequests!.find((r) => r.id === first.id)?.deliveries[0].status).toBe('failed');
});
