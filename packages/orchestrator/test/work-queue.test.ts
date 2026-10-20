import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { adapters } from '@pitchcrew/adapters';
import type {
  ChatContext,
  ChatResult,
  ChatRequest,
  Conversation,
  WorkspaceQueue,
  UserInputRequest,
  AgentTask,
  Run,
} from '@pitchcrew/core';
import { setup, cleanup, waitForSnapshot } from './helpers/daemon.ts';
import { confirmFixtureJob } from '../../board/test/fixtures/application-context.ts';

afterEach(cleanup);
function held() {
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
}
it('runs five independent conversations through the same agent and honors manual global priority', async () => {
  const { request } = await setup(23901);
  const turns = held();
  const threads: Conversation[] = [];
  for (let i = 0; i < 7; i++) {
    const thread = (
      await request<Conversation>('/conversations', 'POST', {
        title: `Topic ${i}`,
        participants: ['scout'],
      })
    ).result;
    threads.push(thread);
    await request(`/conversations/${thread.id}/messages`, 'POST', { content: `Request ${i}` });
  }
  await vi.waitFor(() => expect(turns).toHaveLength(5));
  const queues = (await request<WorkspaceQueue>('/queue')).result;
  expect(queues.active).toBe(5);
  expect(queues.queues).toHaveLength(7);
  await request(`/queue/${encodeURIComponent(`conversation:${threads[6].id}`)}`, 'PUT', {
    action: 'move',
    beforeId: `conversation:${threads[5].id}`,
  });
  turns[0].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(6));
  expect(turns[5].context.request).toBe('Request 6');
  for (const turn of turns) turn.complete();
  await vi.waitFor(() => expect(turns).toHaveLength(7));
  turns[6].complete();
});
it('serializes every attached conversation for one job while other jobs use the same agent in parallel', async () => {
  const { daemon, request } = await setup(23902);
  const turns = held();
  const makeCard = (name: string) =>
    daemon.service.board.createCard({
      company: name,
      title: 'Engineer',
      description: 'Fixture',
      url: '',
      location: '',
      salary: '',
      tags: [],
    });
  const a = makeCard('A'),
    b = makeCard('B');
  const threads: Conversation[] = [];
  for (const [name, card] of [
    ['A1', a],
    ['A2', a],
    ['B', b],
  ] as const) {
    const thread = (
      await request<Conversation>('/conversations', 'POST', {
        title: name,
        participants: ['scout'],
        cardId: card.id,
      })
    ).result;
    threads.push(thread);
    await request(`/conversations/${thread.id}/messages`, 'POST', { content: name });
  }
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(turns.map((t) => t.context.request).sort()).toEqual(['A1', 'B']);
  turns.find((t) => t.context.request === 'A1')!.complete();
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe('A2');
  expect(
    (await request<WorkspaceQueue>('/queue')).result.queues.filter((q) => q.cardId === a.id),
  ).toHaveLength(1);
  turns.find((t) => t.context.request === 'B')!.complete();
  turns[2].complete();
});
it('pauses a failed queue without blocking another conversation and retries only on explicit request', async () => {
  const { request } = await setup(23903);
  const turns = held();
  const a = (
    await request<Conversation>('/conversations', 'POST', { title: 'A', participants: ['scout'] })
  ).result;
  const b = (
    await request<Conversation>('/conversations', 'POST', { title: 'B', participants: ['scout'] })
  ).result;
  const first = (
    await request<ChatRequest>(`/conversations/${a.id}/messages`, 'POST', { content: 'Fail me' })
  ).result;
  await request(`/conversations/${a.id}/messages`, 'POST', { content: 'After failure' });
  await request(`/conversations/${b.id}/messages`, 'POST', { content: 'Independent' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  const failedTurn = turns.find((t) => t.context.request === 'Fail me')!;
  const independentTurn = turns.find((t) => t.context.request === 'Independent')!;
  failedTurn.fail();
  await waitForSnapshot(
    request,
    (s) => s.queue?.queues.some((q) => q.threadId === a.id && q.paused) === true,
  );
  expect(turns).toHaveLength(2);
  expect(independentTurn.context.signal.aborted).toBe(false);
  await request(`/chat-requests/${first.id}`, 'PUT', { action: 'resume' });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe('Fail me');
  turns[2].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(4));
  expect(turns[3].context.request).toBe('After failure');
  independentTurn.complete();
  turns[3].complete();
});
it('rejects invalid stage reordering, deduplicates shortcuts and permits explicit repeated stages', async () => {
  const { daemon, request } = await setup(23904);
  const card = daemon.service.board.createCard({
    company: 'Sequence',
    title: 'Engineer',
    description: 'Fixture',
    url: '',
    location: '',
    salary: '',
    tags: [],
  });
  const draft = (
    await request<ChatRequest>('/queue/actions', 'POST', { cardId: card.id, action: 'draft' })
  ).result;
  const review = (
    await request<ChatRequest>('/queue/actions', 'POST', { cardId: card.id, action: 'review' })
  ).result;
  expect(
    (await request<ChatRequest>('/queue/actions', 'POST', { cardId: card.id, action: 'review' }))
      .result.id,
  ).toBe(review.id);
  const repeated = (
    await request<ChatRequest>('/queue/actions', 'POST', {
      cardId: card.id,
      action: 'review',
      repeat: true,
    })
  ).result;
  expect(repeated.id).not.toBe(review.id);
  const invalid = await request(`/queue/requests/${review.id}/order`, 'PUT', {
    beforeId: draft.id,
  });
  expect(invalid.response.status).toBe(400);
  expect(
    (await request<WorkspaceQueue>('/queue')).result.queues[0].requests.map((r) => r.id),
  ).toEqual([draft.id, review.id, repeated.id]);
  daemon.service.board.rebuild();
  expect((await request<WorkspaceQueue>('/queue')).result.queues[0].requests[0].id).toBe(draft.id);
});
it('requires the local UI session and validates capacity changes', async () => {
  const { request } = await setup(23905);
  expect((await request('/queue/settings', 'PUT', { concurrency: 0 })).response.status).toBe(400);
  expect(
    (
      await request(
        '/queue/settings',
        'PUT',
        { concurrency: 8 },
        { origin: 'https://example.invalid' },
      )
    ).response.status,
  ).toBe(403);
  expect((await request('/queue/settings', 'PUT', { concurrency: 8 })).response.status).toBe(200);
  expect((await request<WorkspaceQueue>('/queue')).result.concurrency).toBe(8);
});

it('holds missing Profile prerequisites without failure and uses notes saved while the action waits', async () => {
  const { daemon, request } = await setup(23912);
  const inputs: Parameters<typeof adapters.demo.run>[0][] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation((context) => {
    inputs.push(context);
    return new Promise((_resolve, reject) => {
      context.signal.addEventListener('abort', () => reject(new Error('Cancelled.')), {
        once: true,
      });
    });
  });
  const card = daemon.service.createCard({ company: 'Current inputs', title: 'Engineer' });
  daemon.service.board.move(card.id, 'shortlisted', 'user');
  confirmFixtureJob(daemon.service.board, card.id);
  const queued = daemon.service.queueBoardAction({ cardId: card.id, action: 'draft' });
  await vi.waitFor(() => expect(daemon.service.queue().queues[0].reason).toContain('Profile'));
  expect(
    daemon.service.board.get<ChatRequest>('chat_request', queued.id).deliveries[0].status,
  ).toBe('queued');
  expect(daemon.service.queue()).toMatchObject({ active: 0, queues: [{ paused: false }] });
  await request('/profile', 'PUT', {
    name: 'profile.md',
    content: '# Fictional Candidate\n\n- Built accessible React interfaces.',
  });
  await daemon.service.tickRoutines();
  await vi.waitFor(() => expect(inputs).toHaveLength(1));
  expect(inputs[0].profile[0].content).toContain('Built accessible React interfaces.');
  expect(daemon.service.board.list<Run>('run')[0].profileDigest).toMatch(/^[a-f0-9]{64}$/);
});

it('releases capacity for a question and puts its answered continuation behind older ready work', async () => {
  const { daemon, request } = await setup(23909);
  daemon.service.configureQueue({ concurrency: 1 });
  const turns = held();
  const threads = ['Question', 'Older', 'Newer'].map((title) =>
    daemon.service.createConversation({ title, participants: ['scout'] }),
  );
  await request(`/conversations/${threads[0].id}/messages`, 'POST', { content: 'Ask me' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const question = (
    await daemon.service.agentCall(turns[0].context.mcp.env.PITCHCREW_RUN_TOKEN, 'ask_user', {
      question: 'Which project?',
    })
  ).question as UserInputRequest;
  await waitForSnapshot(request, (s) => s.runs.some((r) => r.status === 'waiting'));
  await request(`/conversations/${threads[1].id}/messages`, 'POST', { content: 'Older work' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  await request(`/conversations/${threads[2].id}/messages`, 'POST', { content: 'Newer work' });
  await request(`/user-input/${question.id}/answer`, 'POST', { text: 'Scheduling' });
  expect((await request<WorkspaceQueue>('/queue')).result.active).toBe(1);
  expect(turns).toHaveLength(2);
  turns[1].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe('Newer work');
  turns[2].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(4));
  expect(turns[3].context.request).toContain('Answer: Scheduling');
  turns[3].complete();
});

it('stops only the selected job and resumes its remaining requests without restarting cancelled work', async () => {
  const { daemon, request } = await setup(23906);
  const turns = held();
  const jobs = ['A', 'B'].map((company) =>
    daemon.service.createCard({ company, title: 'Engineer' }),
  );
  const threads = jobs.map((card) =>
    daemon.service.createConversation({
      title: card.company,
      participants: ['scout'],
      cardId: card.id,
    }),
  );
  await request(`/conversations/${threads[0].id}/messages`, 'POST', { content: 'A current' });
  await request(`/conversations/${threads[0].id}/messages`, 'POST', { content: 'A next' });
  await request(`/conversations/${threads[1].id}/messages`, 'POST', { content: 'B current' });
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  await request(`/queue/${encodeURIComponent(`job:${jobs[0].id}`)}`, 'PUT', { action: 'stop' });
  expect(turns.find((t) => t.context.request === 'A current')!.context.signal.aborted).toBe(true);
  expect(turns.find((t) => t.context.request === 'B current')!.context.signal.aborted).toBe(false);
  await waitForSnapshot(request, (s) =>
    s.runs.some((r) => r.cardId === jobs[0].id && r.status === 'cancelled'),
  );
  await request(`/queue/${encodeURIComponent(`job:${jobs[0].id}`)}`, 'PUT', { action: 'resume' });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe('A next');
  turns.find((t) => t.context.request === 'B current')!.complete();
  turns[2].complete();
});
it('keeps a failed delegated follow-up in its initiating queue and exposes an explicit retry', async () => {
  const { daemon, request } = await setup(23907);
  const turns = held();
  const job = daemon.service.createCard({ company: 'Follow-up', title: 'Engineer' });
  const thread = daemon.service.createConversation({
    title: 'Follow-up',
    participants: ['scout'],
    cardId: job.id,
  });
  await request(`/conversations/${thread.id}/messages`, 'POST', { content: 'Initial action' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  await daemon.service.agentCall(turns[0].context.mcp.env.PITCHCREW_RUN_TOKEN, 'invoke', {
    roleId: 'writer',
    content: 'Delegated work',
    mode: 'chat',
  });
  await request(`/conversations/${thread.id}/messages`, 'POST', { content: 'Next user action' });
  turns[0].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  turns[1].fail();
  const failed = await waitForSnapshot(
    request,
    (s) =>
      s.queue?.queues.some(
        (q) => q.cardId === job.id && q.tasks.some((t) => t.status === 'failed'),
      ) === true,
  );
  const queue = failed.queue!.queues.find((q) => q.cardId === job.id)!;
  expect(queue.paused).toBe(true);
  expect(turns).toHaveLength(2);
  expect(
    (await request(`/queue/${encodeURIComponent(queue.id)}`, 'PUT', { action: 'resume' })).response
      .status,
  ).toBe(400);
  await request(`/queue/${encodeURIComponent(queue.id)}`, 'PUT', {
    action: 'retry-follow-up',
    taskId: queue.tasks.find((t) => t.status === 'failed')!.id,
  });
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe('Delegated work');
  turns[2].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(4));
  expect(turns[3].context.request).toBe('Next user action');
  turns[3].complete();
});
it('replays saved ordering and capacity and pauses only requests interrupted at startup', async () => {
  const { daemon, request } = await setup(23908);
  const a = daemon.service.createCard({ company: 'Recovery A', title: 'Engineer' }),
    b = daemon.service.createCard({ company: 'Recovery B', title: 'Engineer' });
  const first = daemon.service.queueBoardAction({ cardId: a.id, action: 'draft' });
  const second = daemon.service.queueBoardAction({ cardId: b.id, action: 'draft' });
  daemon.service.configureQueue({ concurrency: 3 });
  daemon.service.updateQueue(`job:${b.id}`, { action: 'move', beforeId: `job:${a.id}` });
  const saved = daemon.service.board.get<ChatRequest>('chat_request', first.id);
  const runId = 'interrupted-fixture';
  daemon.service.board.record(
    'chat_request',
    { ...saved, deliveries: saved.deliveries.map((d) => ({ ...d, status: 'running', runId })) },
    'system',
    'Interrupted fixture',
  );
  daemon.service.board.record(
    'run',
    {
      id: runId,
      requestId: first.id,
      rootRunId: first.id,
      threadId: first.threadId,
      cardId: a.id,
      roleId: 'writer',
      runtime: 'demo',
      status: 'running',
      message: 'Interrupted',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      mode: 'workflow',
    },
    'system',
    'Interrupted fixture',
  );
  await daemon.service.initialize(false);
  daemon.service.board.rebuild();
  const queue = (await request<WorkspaceQueue>('/queue')).result;
  expect(queue.concurrency).toBe(3);
  expect(queue.queues.find((q) => q.cardId === a.id)?.pauseKind).toBe('interrupted');
  expect(
    daemon.service.board.get<ChatRequest>('chat_request', second.id).deliveries[0].status,
  ).toBe('queued');
  expect(queue.queues[0].cardId).toBe(b.id);
});

it('preserves unstarted follow-ups and exposes an interrupted child in its original queue after restart', async () => {
  const { daemon } = await setup(23910);
  const job = daemon.service.createCard({ company: 'Recovery chain', title: 'Engineer' });
  const request = daemon.service.queueBoardAction({ cardId: job.id, action: 'draft' });
  const parent: Run = {
    id: randomUUID(),
    threadId: request.threadId,
    cardId: job.id,
    roleId: 'writer',
    runtime: 'demo',
    status: 'completed',
    mode: 'chat',
    message: 'Parent complete',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  };
  daemon.service.board.record('run', parent, 'system', 'Completed parent fixture');
  const child: AgentTask = {
    id: randomUUID(),
    parentRunId: parent.id,
    rootRunId: parent.id,
    roleId: 'scout',
    cardId: job.id,
    mode: 'chat',
    trigger: 'invoke',
    threadId: request.threadId,
    content: 'Saved child',
    status: 'running',
    runId: randomUUID(),
    error: '',
    createdAt: new Date().toISOString(),
  };
  daemon.service.board.record(
    'run',
    {
      ...parent,
      id: child.runId!,
      roleId: 'scout',
      rootRunId: parent.id,
      taskId: child.id,
      status: 'running',
      finishedAt: null,
    },
    'system',
    'Interrupted child fixture',
  );
  daemon.service.board.record('task', child, 'system', 'Interrupted child task');
  const pending = { ...child, id: randomUUID(), runId: null, status: 'queued' as const };
  daemon.service.board.record('task', pending, 'system', 'Unstarted child task');
  await daemon.service.initialize(false);
  const queue = daemon.service.queue().queues.find((q) => q.cardId === job.id)!;
  expect(queue).toMatchObject({ paused: true, pauseKind: 'interrupted' });
  expect(queue.tasks.find((t) => t.id === child.id)?.status).toBe('failed');
  expect(queue.tasks.find((t) => t.id === pending.id)?.status).toBe('queued');
});

it('shows job-linked routines in their job queue and keeps job-free routines outside the view while sharing capacity', async () => {
  const { daemon, request } = await setup(23911);
  daemon.service.configureQueue({ concurrency: 1 });
  const turns = held();
  const job = daemon.service.createCard({ company: 'Scheduled job', title: 'Engineer' });
  const thread = daemon.service.createConversation({
    title: 'Scheduled job',
    participants: ['scout'],
    cardId: job.id,
  });
  await request(`/conversations/${thread.id}/messages`, 'POST', { content: 'Current action' });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const schedule = {
    name: 'Attached routine',
    roleId: 'scout',
    content: 'Attached action',
    startAt: '2030-01-01T09:00:00Z',
    timezone: 'UTC',
  };
  const attached = daemon.service.saveRoutine({ ...schedule, cardId: job.id });
  const background = daemon.service.saveRoutine({
    ...schedule,
    name: 'Background routine',
    content: 'Background action',
  });
  const now = new Date('2030-01-01T09:01:00Z');
  await daemon.service.tickRoutines(now);
  const queued = daemon.service.queue();
  expect(queued.queues).toHaveLength(1);
  expect(queued.queues[0].requests.some((r) => r.routine?.routineId === attached.id)).toBe(true);
  expect(daemon.service.routines().find((r) => r.id === background.id)?.runCount).toBe(0);
  turns[0].complete();
  await vi.waitFor(() => expect(turns).toHaveLength(2));
  expect(turns[1].context.request).toBe('Attached action');
  turns[1].complete();
  await waitForSnapshot(request, (s) => s.queue?.active === 0);
  await daemon.service.tickRoutines(now);
  await vi.waitFor(() => expect(turns).toHaveLength(3));
  expect(turns[2].context.request).toBe('Background action');
  expect(daemon.service.queue()).toMatchObject({ active: 1, background: 1, queues: [] });
  turns[2].complete();
});
